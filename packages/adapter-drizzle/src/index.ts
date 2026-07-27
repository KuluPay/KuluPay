import { createDrizzleDriver } from "@farming-labs/orm-drizzle";

export interface DrizzleAdapterOptions {
  provider: "pg" | "mysql" | "sqlite";
}

/**
 * Drizzle ORM adapter for KuluPay.
 *
 * Reuses an existing Drizzle `db` instance so you don't create a second database connection.
 *
 * @example
 * ```ts
 * import { kuluPay } from "@kulupay/core";
 * import { drizzleAdapter } from "@kulupay/adapter-drizzle";
 * import { drizzle } from "drizzle-orm/node-postgres";
 * import { Pool } from "pg";
 *
 * const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
 *
 * const pay = kuluPay({
 *   database: drizzleAdapter(db, { provider: "pg" }),
 *   providers: [...],
 * });
 * ```
 */
export function drizzleAdapter<DB = any>(
  db: DB,
  options: DrizzleAdapterOptions,
): any {
  const dialectMap = {
    pg: "postgres",
    mysql: "mysql",
    sqlite: "sqlite",
  } as const;

  return createDrizzleDriver({
    db: db as any,
    dialect: dialectMap[options.provider] as any,
  });
}

export { createDrizzleDriver } from "@farming-labs/orm-drizzle";
