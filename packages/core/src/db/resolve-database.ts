/**
 * Resolves the database option into a Farming ORM driver.
 *
 * Following the Farming ORM pattern, the user creates the driver themselves
 * and passes it to the `database` option. This keeps KuluPay agnostic of
 * the underlying database engine (Postgres, MySQL, SQLite, Neon, Supabase, etc.).
 *
 * @example
 * ```ts
 * import { pg } from "@kulupay/adapter-sql";
 * import { Pool } from "pg";
 *
 * const pay = kuluPay({
 *   database: pg(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [myProvider],
 * });
 * ```
 *
 * For Neon:
 * ```ts
 * import { pg } from "@kulupay/adapter-sql";
 * import { Pool } from "@neondatabase/serverless";
 *
 * const pay = kuluPay({
 *   database: pg(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [myProvider],
 * });
 * ```
 */
export async function resolveDatabaseDriver(database: any): Promise<any> {
    if (!database) {
        throw new Error(
            "KuluPay: No database configured. Pass a Farming ORM driver to the `database` option.\n\nExample:\n  import { pg } from \"@kulupay/adapter-sql\";\n  import { Pool } from \"pg\";\n\n  kuluPay({ database: pg(new Pool({ connectionString })), ... });",
        );
    }

    return database;
}
