import { createMemoryDriver } from "@farming-labs/orm";

/**
 * Resolves a database configuration into a Farming ORM driver.
 *
 * Accepts multiple input formats for convenience:
 * - A connection string (e.g. `"postgresql://user:pass@host/db"`)
 * - A `pg.Pool` instance (detected via `.query` and `.connect` methods)
 * - A `pg.Client` instance (detected via `.query` without `.connect`)
 * - A Farming ORM driver (passed through as-is)
 *
 * For connection strings and pg instances, the corresponding driver package
 * (`@farming-labs/orm-sql`) must be installed. If it's not installed, a helpful
 * error message is thrown.
 *
 * @param database - The database configuration value from `KuluPayOptions.database`.
 * @returns A Farming ORM driver instance.
 */
export async function resolveDatabaseDriver(database: any): Promise<any> {
    if (!database) {
        throw new Error(
            "KuluPay: No database configured. Pass a connection string, pg Pool, or Farming ORM driver to the `database` option.",
        );
    }

    // Already a Farming ORM driver — pass through
    if (typeof database === "object" && !isPgPool(database) && !isPgClient(database)) {
        return database;
    }

    // Connection string
    if (typeof database === "string") {
        return await createDriverFromConnectionString(database);
    }

    // pg Pool instance
    if (isPgPool(database)) {
        return await wrapPgPool(database);
    }

    // pg Client instance
    if (isPgClient(database)) {
        return await wrapPgClient(database);
    }

    // Unknown — pass through and let Farming ORM handle it
    return database;
}

function isPgPool(obj: any): boolean {
    return (
        obj &&
        typeof obj.query === "function" &&
        typeof obj.connect === "function" &&
        typeof obj.on === "function" &&
        typeof obj.end === "function"
    );
}

function isPgClient(obj: any): boolean {
    return (
        obj &&
        typeof obj.query === "function" &&
        typeof obj.connect === "function" &&
        typeof obj.on !== "function"
    );
}

async function createDriverFromConnectionString(connectionString: string): Promise<any> {
    let createPgPoolDriver: any;
    try {
        ({ createPgPoolDriver } = await import("@farming-labs/orm-sql"));
    } catch {
        throw new Error(
            "KuluPay: To use a connection string, install the database driver package:\n  pnpm add @farming-labs/orm-sql pg\n\nThen pass the connection string to the `database` option.",
        );
    }

    let Pool: any;
    try {
        ({ Pool } = await import("pg"));
    } catch {
        throw new Error(
            "KuluPay: The `pg` package is required for Postgres connections. Install it with:\n  pnpm add pg",
        );
    }

    return createPgPoolDriver(new Pool({ connectionString }));
}

async function wrapPgPool(pool: any): Promise<any> {
    let createPgPoolDriver: any;
    try {
        ({ createPgPoolDriver } = await import("@farming-labs/orm-sql"));
    } catch {
        throw new Error(
            "KuluPay: To use a pg Pool, install the driver adapter:\n  pnpm add @farming-labs/orm-sql",
        );
    }

    return createPgPoolDriver(pool);
}

async function wrapPgClient(client: any): Promise<any> {
    let createPgClientDriver: any;
    try {
        const mod = await import("@farming-labs/orm-sql");
        createPgClientDriver = mod.createPgClientDriver || mod.createPgPoolDriver;
    } catch {
        throw new Error(
            "KuluPay: To use a pg Client, install the driver adapter:\n  pnpm add @farming-labs/orm-sql",
        );
    }

    return createPgClientDriver(client);
}
