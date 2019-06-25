import { Pool } from "pg";
import { Authorization } from "./model";
import { StrategyCollection } from "./StrategyCollection";

export interface Context {
  realm: string;
  base: string;
  privateKey: string;
  publicKeys: string[];
  codeValidityDuration: number;
  jwtValidityDuration: number;
  sendMail: (options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    from?: string;
  }) => Promise<any>;
  pool: Pool;
  strategies: StrategyCollection;
  authorization: null | Authorization;
}
