import { PoolClient } from "pg";
import { test } from "scopeutils";
import { Credential } from "./Credential";

const CREDENTIALS = Symbol("credentials");

export class Authority<T = {}> {
  public id: string;
  public name: string;
  public strategy: string;
  public details: T;

  private [CREDENTIALS]: null | Promise<Credential[]> = null;

  public constructor(data: {
    id: string;
    name: string;
    strategy: string;
    details: T;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.strategy = data.strategy;
    this.details = data.details;
  }

  public async credentials(
    tx: PoolClient,
    refresh: boolean = false
  ): Promise<Credential[]> {
    const credentials = this[CREDENTIALS];
    if (credentials && !refresh) {
      return credentials;
    }

    return (this[CREDENTIALS] = (async () =>
      Credential.read(
        tx,
        (await tx.query(
          `
          SELECT entity_id AS id
          FROM authx.credential_records
          WHERE
            authority_id = $1
            AND replacement_id IS NULL
          `,
          [this.id]
        )).rows.map(({ id }) => id)
      ))());
  }

  public static async read(
    tx: PoolClient,
    id: string | string[]
  ): Promise<Authority[]> {
    const result = await tx.query(
      `
      SELECT
        entity_id AS id,
        name,
        strategy,
        details
      FROM authx.authority_record
      WHERE
        entity_id = ANY($1)
        AND replacement_id IS NULL
      `,
      [id]
    );

    return result.rows.map(
      row =>
        new Authority({
          ...row,
          baseUrls: row.base_urls
        })
    );
  }

  public static async write(
    tx: PoolClient,
    data: Authority,
    metadata: {
      recordId: string;
      createdByAuthorityId: string;
      createdAt: string;
    }
  ): Promise<Authority> {
    // ensure that the entity ID exists
    await tx.query(
      `
      INSERT INTO authx.authority
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
      UPDATE authx.authority_record
      SET replacement_id = $2
      WHERE
        entity_id = $1
        AND replacement_id IS NULL
      RETURNING id
      `,
      [data.id, metadata.recordId]
    );

    if (previous.rows.length >= 1) {
      throw new Error(
        "INVARIANT: It must be impossible to replace more than one record."
      );
    }

    // insert the new record
    const next = await tx.query(
      `
      INSERT INTO authx.authority_record
        (id, created_by_authority_id, created_at, entity_id, name, strategy, details)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        entity_id AS id,
        name,
        strategy,
        details
      `,
      [
        metadata.recordId,
        metadata.createdByAuthorityId,
        metadata.createdAt,
        data.id,
        data.name,
        data.strategy,
        data.details
      ]
    );

    if (next.rows.length !== 1) {
      throw new Error("INVARIANT: Insert must return exactly one row.");
    }

    const row = next.rows[0];
    return new Authority({
      ...row,
      baseUrls: row.base_urls
    });
  }
}
