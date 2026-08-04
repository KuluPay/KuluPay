import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import { renderSafeSql } from "@farming-labs/orm";
import { getKuluPayTables } from "@kulupay/core/db";
import { resolveDatabaseDriver } from "@kulupay/core/db";
import { getConfig } from "../utils/get-config";

interface MigrationGuide {
    toolName: string;
    commands: string[];
    configFiles?: { name: string; content: string }[];
    description: string;
}

function detectDbType(database: any): { kind: string; dialect: string } {
    const driver = database?.handle || database;
    const kind = driver?.kind || "unknown";
    const dialect = driver?.dialect || "postgres";
    return { kind, dialect };
}

function getMigrationGuide(kind: string, dialect: string, cwd: string): MigrationGuide | null {
    if (kind === "drizzle") {
        const drizzleConfigPath = path.join(cwd, "drizzle.config.ts");
        const needsDrizzleConfig = !existsSync(drizzleConfigPath);

        const configFiles = needsDrizzleConfig
            ? [{
                  name: "drizzle.config.ts",
                  content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./pay-schema.ts",
  out: "./drizzle",
  dialect: "${dialect === "postgres" ? "postgresql" : dialect}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});`,
              }]
            : undefined;

        return {
            toolName: "drizzle-kit",
            description: "Drizzle ORM uses drizzle-kit for migrations",
            commands: [
                `npx drizzle-kit generate`,
                `# Review the generated SQL in ./drizzle/`,
                `npx drizzle-kit migrate`,
            ],
            configFiles,
        };
    }

    if (kind === "prisma") {
        return {
            toolName: "prisma",
            description: "Prisma uses prisma migrate for migrations",
            commands: [
                `npx prisma migrate dev --name kulupay`,
                `# Review the generated SQL in prisma/migrations/`,
                `npx prisma migrate deploy`,
            ],
        };
    }

    if (kind === "postgres" || kind === "mysql" || kind === "sqlite") {
        return {
            toolName: "raw SQL",
            description: "Raw SQL adapter — execute the generated SQL file directly",
            commands: [
                `# Review the SQL file first:`,
                `cat sql/kulupay.sql`,
                `# Then execute it with your database client:`,
                kind === "postgres"
                    ? `psql "$DATABASE_URL" -f sql/kulupay.sql`
                    : kind === "mysql"
                      ? `mysql -u root -p < sql/kulupay.sql`
                      : `sqlite3 kulupay.db < sql/kulupay.sql`,
            ],
        };
    }

    if (kind === "memory") {
        return {
            toolName: "memory",
            description: "Memory driver — no migration needed, tables are created automatically",
            commands: [],
        };
    }

    return null;
}

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

    const driver = await resolveDatabaseDriver(kuluPayOptions.database);
    const { kind, dialect } = detectDbType(driver);

    if (kind === "memory") {
        console.log(chalk.yellow("Memory driver detected — no migration needed. Tables are created in-memory automatically."));
        process.exit(0);
        return;
    }

    const guide = getMigrationGuide(kind, dialect, cwd);
    if (!guide) {
        console.error(
            `Could not detect database type from your config. Detected kind: ${chalk.red(kind)}.\nMake sure your database adapter is set up correctly.`,
        );
        console.log();
        console.log(chalk.gray("You can still generate the schema and migrate manually:"));
        console.log(`  ${chalk.cyan("npx kulupay generate")}  — generate schema file`);
        console.log(`  ${chalk.cyan("npx drizzle-kit push")}  — for Drizzle users`);
        console.log(`  ${chalk.cyan("npx prisma db push")}   — for Prisma users`);
        process.exit(1);
        return;
    }

    console.log(chalk.cyan("Preparing migration..."));

    const schema = getKuluPayTables(kuluPayOptions);
    const sql = renderSafeSql(schema, { dialect: dialect as "postgres" | "mysql" | "sqlite" });

    console.log(`Detected database: ${chalk.cyan(kind)} (${chalk.yellow(dialect)})`);
    console.log(`Migration tool: ${chalk.cyan(guide.toolName)}`);
    console.log();

    if (guide.configFiles && guide.configFiles.length > 0) {
        for (const configFile of guide.configFiles) {
            const fullPath = path.join(cwd, configFile.name);
            if (!existsSync(fullPath)) {
                await fs.writeFile(fullPath, configFile.content);
                console.log(`${chalk.green("✓")} Created ${chalk.cyan(configFile.name)}`);
            } else {
                console.log(`${chalk.gray("✓")} ${chalk.cyan(configFile.name)} already exists`);
            }
        }
        console.log();
    }

    if (guide.commands.length > 0) {
        console.log(chalk.gray("Run these commands to migrate:"));
        for (const cmd of guide.commands) {
            console.log(`  ${chalk.cyan(cmd)}`);
        }
        console.log();

        const shouldRun = options.yes === true
            ? true
            : (await prompts({
                  type: "confirm",
                  name: "runNow",
                  message: `Run ${chalk.cyan(guide.commands[0])} now?`,
                  initial: false,
              })).runNow;

        if (shouldRun) {
            const { exec } = await import("node:child_process");
            for (const cmd of guide.commands) {
                if (cmd.startsWith("#") || cmd.trim() === "") continue;
                console.log(chalk.gray(`> ${cmd}`));
                await new Promise<void>((resolve) => {
                    exec(cmd, { cwd }, (error, stdout, stderr) => {
                        if (stdout) console.log(stdout);
                        if (stderr) console.error(stderr);
                        if (error) {
                            console.error(chalk.red(`Command failed: ${cmd}`));
                        }
                        resolve();
                    });
                });
            }
            console.log();
            console.log(chalk.green("🚀 Migration complete!"));
        } else {
            console.log();
            console.log(chalk.gray("You can run the commands above manually at any time."));
        }
    } else {
        console.log(chalk.gray("No migration commands needed."));
    }

    console.log();
    console.log(chalk.gray("Generated SQL (for reference):"));
    console.log(chalk.gray("---"));
    console.log(chalk.green(sql));
    console.log(chalk.gray("---"));

    process.exit(0);
}

export const migrate = new Command("migrate")
    .description("Push KuluPay schema to your database using your ORM's migration tool")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("--config <config>", "path to your KuluPay config file")
    .option("-y, --yes", "skip confirmation prompt and run migration", false)
    .action(migrateAction);
