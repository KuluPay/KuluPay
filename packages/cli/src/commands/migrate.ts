import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import { createOrm, renderSafeSql } from "@farming-labs/orm";
import { getKuluPayTables } from "@kulupay/core/db";
import { resolveDatabaseDriver } from "@kulupay/core/db";
import { getConfig } from "../utils/get-config";

/**
 * Pushes the KuluPay schema to the user's database.
 * Reads the user's `pay.ts` config, generates SQL from the schema,
 * detects the database runtime, and executes the migration.
 *
 * @param opts - Command options including cwd, config path, and auto-confirm flag.
 */
export async function migrateAction(opts: any) {
    const options = opts;
    const cwd = path.resolve(options.cwd);
    if (!existsSync(cwd)) {
        console.error(`The directory "${cwd}" does not exist.`);
        process.exit(1);
        return;
    }

    const config = await getConfig({ cwd, configPath: options.config });
    if (!config) {
        console.error(
            "No configuration file found. Add a `pay.ts` file to your project or pass the path using the `--config` flag.",
        );
        process.exit(1);
        return;
    }

    const kuluPayOptions = config.options;
    if (!kuluPayOptions.database) {
        console.error(
            "No database configured. Add a `database` option to your KuluPay config.",
        );
        process.exit(1);
        return;
    }

    console.log(chalk.cyan("Preparing migration..."));

    const schema = getKuluPayTables(kuluPayOptions);

    const driver = await resolveDatabaseDriver(kuluPayOptions.database);
    const handle = (driver as any).handle;
    if (!handle) {
        console.error(
            "Could not read database driver. Make sure you're passing a Farming ORM driver created via createPgPoolDriver, createMysqlDriver, createSqliteDriver, createMemoryDriver, etc.",
        );
        process.exit(1);
        return;
    }

    const kind = handle.kind as string;
    const dialect = (handle.dialect || "postgres") as "postgres" | "mysql" | "sqlite";

    if (kind === "memory") {
        console.log(chalk.yellow("Memory driver detected — no migration needed. Tables are created in-memory automatically."));
        process.exit(0);
        return;
    }

    const sql = renderSafeSql(schema, { dialect });

    console.log(`🔑 Detected database: ${chalk.cyan(kind)} (${chalk.yellow(dialect)})`);
    console.log("");
    console.log("The following SQL will be executed:");
    console.log(chalk.gray("---"));
    console.log(chalk.green(sql));
    console.log(chalk.gray("---"));
    console.log("");

    let shouldMigrate = options.yes;
    if (!shouldMigrate) {
        const response = await prompts({
            type: "confirm",
            name: "migrate",
            message: "Are you sure you want to run this migration?",
            initial: false,
        });
        shouldMigrate = response.migrate;
    }

    if (!shouldMigrate) {
        console.log("Migration cancelled.");
        process.exit(0);
    }

    console.log(chalk.cyan("Migrating..."));

    try {
        const orm = createOrm({
            schema,
            driver,
        });

        for (const modelName of Object.keys((schema as any).models || schema)) {
            const modelDef = ((schema as any).models || schema)[modelName];
            const tableName = modelDef?.table || modelName;
            try {
                const existing = await (orm as any)[modelName].findMany({});
                if (existing) {
                    console.log(
                        chalk.yellow(`Table "${tableName}" already has data. Skipping creation.`),
                    );
                    continue;
                }
            } catch {
                // Table doesn't exist yet — proceed with creation
            }
        }

        await executeMigration(driver, sql, kind);
        console.log("🚀 Migration completed successfully!");
        console.log(chalk.gray("Note: This only creates missing tables. For column updates, run `kulupay generate` and apply changes via your ORM's migration tool."));
    } catch (e: any) {
        console.error("Migration failed:", e?.message || e);
        process.exit(1);
    }

    process.exit(0);
}

async function executeMigration(driver: any, sql: string, kind: string) {
    const client = driver?.handle?.client;
    if (!client) {
        throw new Error(
            `Cannot access underlying database client for driver kind "${kind}". Use \`npx @kulupay/cli generate\` to create schema files, then apply them with your ORM's migration tool.`,
        );
    }

    const statements = sql.split(";").filter((s: string) => s.trim());

    if (typeof client.query === "function") {
        for (const stmt of statements) {
            await client.query(stmt + ";");
        }
        return;
    }

    if (typeof client.$executeRawUnsafe === "function") {
        for (const stmt of statements) {
            await client.$executeRawUnsafe(stmt + ";");
        }
        return;
    }

    if (typeof client.exec === "function") {
        for (const stmt of statements) {
            client.exec(stmt + ";");
        }
        return;
    }

    if (typeof client.run === "function") {
        for (const stmt of statements) {
            await client.run(stmt + ";");
        }
        return;
    }

    const fallbackPath = path.join(process.cwd(), "kulupay-migration.sql");
    await fs.writeFile(fallbackPath, sql);
    throw new Error(
        `Cannot execute raw SQL for database type "${kind}" (client has no query/exec/run/$executeRawUnsafe method).\nSQL has been written to ${fallbackPath} — run it manually with your database tool.`,
    );
}

export const migrate = new Command("migrate")
    .description("Push KuluPay schema tables to your database")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("--config <config>", "path to your KuluPay config file")
    .option("-y, --yes", "skip confirmation prompt", false)
    .action(migrateAction);
