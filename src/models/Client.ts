import { PoolClient } from "pg";
import { Grant } from "./Grant";
import { User } from "./User";
import { Token } from "./Token";
import { NotFoundError } from "../errors";

export interface ClientData {
  readonly id: string;
  readonly enabled: boolean;
  readonly name: string;
  readonly oauth2Secrets: Iterable<string>;
  readonly oauth2Urls: Iterable<string>;
  readonly userIds: Iterable<string>;
}

export class Client implements ClientData {
  public readonly id: string;
  public readonly enabled: boolean;
  public readonly name: string;
  public readonly oauth2Secrets: Set<string>;
  public readonly oauth2Urls: Set<string>;
  public readonly userIds: Set<string>;

  private _grants: null | Promise<Grant[]> = null;
  private _users: null | Promise<User[]> = null;

  public constructor(data: ClientData) {
    this.id = data.id;
    this.enabled = data.enabled;
    this.name = data.name;
    this.oauth2Secrets = new Set(data.oauth2Secrets);
    this.oauth2Urls = new Set(data.oauth2Urls);
    this.userIds = new Set(data.userIds);
  }

  public async isAccessibleBy(
    realm: string,
    t: Token,
    tx: PoolClient,
    action: string = "read.basic"
  ): Promise<boolean> {
    // can access all vlients
    if (await t.can(tx, `${realm}:client.*:${action}`)) {
      return true;
    }

    // can access assigned clients
    return (
      this.userIds.has(t.userId) &&
      (await t.can(tx, `${realm}:client.assigned:${action}`))
    );
  }

  public grants(tx: PoolClient, refresh: boolean = true): Promise<Grant[]> {
    if (!refresh && this._grants) {
      return this._grants;
    }

    return (this._grants = (async () =>
      Grant.read(
        tx,
        (await tx.query(
          `
            SELECT entity_id AS id
            FROM authx.grant_records
            WHERE
              client_id = $1
              AND enabled = TRUE
              AND replacement_record_id IS NULL
            `,
          [this.id]
        )).rows.map(({ id }) => id)
      ))());
  }

  public users(tx: PoolClient, refresh: boolean = false): Promise<User[]> {
    if (!refresh && this._users) {
      return this._users;
    }

    return (this._users = User.read(tx, [...this.userIds]));
  }

  public static read(tx: PoolClient, id: string): Promise<Client>;
  public static read(tx: PoolClient, id: string[]): Promise<Client[]>;
  public static async read(
    tx: PoolClient,
    id: string[] | string
  ): Promise<Client[] | Client> {
    if (typeof id !== "string" && !id.length) {
      return [];
    }

    const result = await tx.query(
      `
      SELECT
        entity_id AS id,
        enabled,
        name,
        oauth2_secrets,
        oauth2_urls,
        json_agg(authx.client_record_user.user_id) AS user_ids
      FROM authx.client_record
      LEFT JOIN authx.client_record_user
        ON authx.client_record_user.client_record_id = authx.client_record.record_id
      WHERE
        entity_id = ANY($1)
        AND replacement_record_id IS NULL
      GROUP BY
        authx.client_record.entity_id,
        authx.client_record.enabled,
        authx.client_record.name,
        authx.client_record.oauth2_secrets,
        authx.client_record.oauth2_urls
      `,
      [typeof id === "string" ? [id] : id]
    );

    if (result.rows.length > (typeof id === "string" ? 1 : id.length)) {
      throw new Error(
        "INVARIANT: Read must never return more records than requested."
      );
    }

    if (result.rows.length < (typeof id === "string" ? 1 : id.length)) {
      throw new NotFoundError();
    }

    const clients = result.rows.map(
      row =>
        new Client({
          ...row,
          oauth2Secrets: row.oauth2_secrets,
          oauth2Urls: row.oauth2_urls,
          userIds: row.user_ids.filter((id: null | string) => id)
        })
    );

    return typeof id === "string" ? clients[0] : clients;
  }

  public static async write(
    tx: PoolClient,
    data: ClientData,
    metadata: { recordId: string; createdByTokenId: string; createdAt: Date }
  ): Promise<Client> {
    // ensure that the entity ID exists
    await tx.query(
      `
      INSERT INTO authx.client
        (id)
      VALUES
        ($1)
      ON CONFLICT DO NOTHING
      `,
      [data.id]
    );

    // replace the previous record
    const previous = await tx.query(
      `
      UPDATE authx.client_record
      SET replacement_record_id = $2
      WHERE entity_id = $1 AND replacement_record_id IS NULL
      RETURNING entity_id AS id, record_id
      `,
      [data.id, metadata.recordId]
    );

    if (previous.rows.length > 1) {
      throw new Error(
        "INVARIANT: It must be impossible to replace more than one record."
      );
    }

    // insert the new record
    const next = await tx.query(
      `
      INSERT INTO authx.client_record
      (
        record_id,
        created_by_token_id,
        created_at,
        entity_id,
        enabled,
        name,
        oauth2_secrets,
        oauth2_urls
      )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        entity_id AS id,
        enabled,
        name,
        oauth2_secrets,
        oauth2_urls
      `,
      [
        metadata.recordId,
        metadata.createdByTokenId,
        metadata.createdAt,
        data.id,
        data.enabled,
        data.name,
        [...new Set(data.oauth2Secrets)],
        [...new Set(data.oauth2Urls)]
      ]
    );

    if (next.rows.length !== 1) {
      throw new Error("INVARIANT: Insert must return exactly one row.");
    }

    // insert the new record's users
    const userIds = [...new Set(data.userIds)];
    const users = await tx.query(
      `
      INSERT INTO authx.client_record_user
        (client_record_id, user_id)
      SELECT $1::uuid AS client_record_id, user_id FROM UNNEST($2::uuid[]) AS user_id
      RETURNING user_id
      `,
      [metadata.recordId, userIds]
    );

    if (users.rows.length !== userIds.length) {
      throw new Error(
        "INVARIANT: Insert or user IDs must return the same number of rows as input."
      );
    }

    const row = next.rows[0];
    return new Client({
      ...row,
      oauth2Secrets: row.oauth2_secrets,
      oauth2Urls: row.oauth2_urls,
      userIds: users.rows.map(({ user_id: userId }) => userId)
    });
  }
}
