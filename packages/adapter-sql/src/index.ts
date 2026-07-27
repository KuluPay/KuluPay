import type { Pool } from "pg";
import type { Connection, ConnectionOptions } from "mysql2";
import type { Database } from "better-sqlite3";
import type { OrmDriver } from "@farming-labs/orm";
import {
  createPgPoolDriver,
  createMysqlDriver,
  createSqliteDriver,
} from "@farming-labs/orm-sql";

/**
 * PostgreSQL adapter for KuluPay.
 *
 * Reuses an existing `pg` Pool so you don't create a second database connection.
 *
 * @example
 * ```ts
 * import { pg } from "@kulupay/adapter-sql";
 * import { Pool } from "pg";
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 * const pay = kuluPay({
 *   database: pg(pool),
 *   providers: [...],
 * });
 * ```
 */
export function pg(pool: Pool): OrmDriver<any, any> {
  return createPgPoolDriver(pool);
}

/**
 * MySQL adapter for KuluPay.
 *
 * Reuses an existing `mysql2` connection.
 *
 * @example
 * ```ts
 * import { mysql } from "@kulupay/adapter-sql";
 * import mysql2 from "mysql2/promise";
 *
 * const connection = await mysql2.createConnection(process.env.DATABASE_URL);
 *
 * const pay = kuluPay({
 *   database: mysql(connection),
 *   providers: [...],
 * });
 * ```
 */
export function mysql(connection: Connection | ConnectionOptions): OrmDriver<any, any> {
  return createMysqlDriver(connection as any);
}

/**
 * SQLite adapter for KuluPay.
 *
 * Reuses an existing `better-sqlite3` database instance.
 *
 * @example
 * ```ts
 * import { sqlite } from "@kulupay/adapter-sql";
 * import Database from "better-sqlite3";
 *
 * const db = new Database("kulupay.db");
 *
 * const pay = kuluPay({
 *   database: sqlite(db),
 *   providers: [...],
 * });
 * ```
 */
export function sqlite(db: Database): OrmDriver<any, any> {
  return createSqliteDriver(db);
}

export { createPgPoolDriver, createMysqlDriver, createSqliteDriver } from "@farming-labs/orm-sql";
