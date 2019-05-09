import { PoolClient } from "pg";
import { Authority } from "../../../model";
import { OpenIdCredential } from "./OpenIdCredential";

// Authority
// ---------

export interface OpenIdAuthorityDetails {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;

  restrictToHostedDomains: string[];

  emailAuthorityId: null | string;
  matchUsersByEmail: boolean;
  createUnmatchedUsers: boolean;
  assignCreatedUsersToRoleIds: string[];
}

export class OpenIdAuthority extends Authority<OpenIdAuthorityDetails> {
  private _credentials: null | Promise<OpenIdCredential[]> = null;

  public credentials(
    tx: PoolClient,
    refresh: boolean = false
  ): Promise<OpenIdCredential[]> {
    if (!refresh && this._credentials) {
      return this._credentials;
    }

    return (this._credentials = (async () =>
      OpenIdCredential.read(
        tx,
        (await tx.query(
          `
              SELECT entity_id AS id
              FROM authx.credential_records
              WHERE
                authority_id = $1
                AND replacement_record_id IS NULL
              `,
          [this.id]
        )).rows.map(({ id }) => id)
      ))());
  }

  public async credential(
    tx: PoolClient,
    authorityUserId: string
  ): Promise<null | OpenIdCredential> {
    const results = await tx.query(
      `
      SELECT entity_id AS id
      FROM authx.credential_record
      WHERE
        authority_id = $1
        AND authority_user_id = $2
        AND enabled = true
        AND replacement_record_id IS NULL
    `,
      [this.id, authorityUserId]
    );

    if (results.rows.length > 1) {
      throw new Error(
        "INVARIANT: There cannot be more than one active credential for the same user and authority."
      );
    }

    if (!results.rows[0]) return null;

    return OpenIdCredential.read(tx, results.rows[0].id);
  }
}