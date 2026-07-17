import { existsSync } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import yoctoSpinner from "yocto-spinner";
import { createOrm, renderSafeSql, detectDatabaseRuntime } from "@farming-labs/orm";
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

    const spinner = yoctoSpinner({ text: "Preparing migration..." }).start();

    const schema = getKuluPayTables(kuluPayOptions);

    const driver = await resolveDatabaseDriver(kuluPayOptions.database);
    const runtime = detectDatabaseRuntime(driver);
    if (!runtime) {
        spinner.stop();
        console.error(
            "Could not detect database type. Make sure you're passing a supported database client (Prisma, Drizzle, Kysely, pg, mysql2, etc).",
        );
        process.exit(1);
        return;
    }

    const dialect = (runtime as any).dialect || "postgres";
    const sql = renderSafeSql(schema, { dialect: dialect as "postgres" | "mysql" | "sqlite" });

    spinner.stop();

    console.log(`🔑 Detected database: ${chalk.cyan(runtime.kind)} (${chalk.yellow(dialect)})`);
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

    spinner.start("Migrating...");

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
                    spinner.stop();
                    console.log(
                        chalk.yellow(`Table "${tableName}" already has data. Skipping creation.`),
                    );
                    spinner.start();
                    continue;
                }
            } catch {
                // Table doesn't exist yet — proceed with creation
            }
        }

        await executeMigration(driver, sql, runtime);
        spinner.stop();
        console.log("🚀 Migration completed successfully!");
    } catch (e: any) {
        spinner.stop();
        console.error("Migration failed:", e?.message || e);
        process.exit(1);
    }

    process.exit(0);
}

async function executeMigration(database: any, sql: string, runtime: any) {
    const kind = runtime.kind;

    if (kind === "kysely" || kind === "sql" || kind === "drizzle") {
        if (typeof database.connection?.query === "function") {
            const statements = sql.split(";").filter((s) => s.trim());
            for (const stmt of statements) {
                await database.connection.query(stmt + ";");
            }
            return;
        }
        if (typeof database.query === "function") {
            const statements = sql.split(";").filter((s) => s.trim());
            for (const stmt of statements) {
                await database.query(stmt + ";");
            }
            return;
        }
    }

    if (kind === "prisma") {
        if (typeof database.$executeRawUnsafe === "function") {
            const statements = sql.split(";").filter((s) => s.trim());
            for (const stmt of statements) {
                await database.$executeRawUnsafe(stmt + ";");
            }
            return;
        }
    }

    throw new Error(
        `Cannot execute raw SQL for database type "${kind}". Use \`npx @kulupay/cli generate\` to create schema files, then apply them with your ORM's migration tool.`,
    );
}

export const migrate = new Command("migrate")
    .description("Push KuluPay schema tables to your database")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("--config <config>", "path to your KuluPay config file")
    .option("-y, --yes", "skip confirmation prompt", false)
    .action(migrateAction);
