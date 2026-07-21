/**
 * Resolves the database option into a Farming ORM driver.
 *
 * Following the Farming ORM pattern, the user creates the driver themselves
 * and passes it to the `database` option. This keeps KuluPay agnostic of
 * the underlying database engine (Postgres, MySQL, SQLite, Neon, Supabase, etc.).
 *
 * @example
 * ```ts
 * import { createPgPoolDriver } from "@farming-labs/orm-sql";
 * import { Pool } from "pg";
 *
 * const pay = kuluPay({
 *   database: createPgPoolDriver(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [myProvider],
 * });
 * ```
 *
 * For Neon:
 * ```ts
 * import { createPgPoolDriver } from "@farming-labs/orm-sql";
 * import { Pool } from "@neondatabase/serverless";
 *
 * const pay = kuluPay({
 *   database: createPgPoolDriver(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [myProvider],
 * });
 * ```
 */
export async function resolveDatabaseDriver(database: any): Promise<any> {
    if (!database) {
        throw new Error(
            "KuluPay: No database configured. Pass a Farming ORM driver to the `database` option.\n\nExample:\n  import { createPgPoolDriver } from \"@farming-labs/orm-sql\";\n  import { Pool } from \"pg\";\n\n  kuluPay({ database: createPgPoolDriver(new Pool({ connectionString })), ... });",
        );
    }

    return database;
}
