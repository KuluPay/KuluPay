import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import { getKuluPayTables } from "@kulupay/core/db";
import { renderPrismaSchema, renderDrizzleSchema, renderSafeSql } from "@farming-labs/orm";
import { getConfig } from "../utils/get-config";

type Generator = "prisma" | "drizzle" | "sql";

const defaultOutput: Record<Generator, string> = {
    prisma: "prisma/schema.prisma",
    drizzle: "pay-schema.ts",
    sql: "pay-schema.sql",
};

/**
 * Generates database schema files (Prisma, Drizzle, or SQL) from the KuluPay config.
 * Reads the user's `pay.ts` config, auto-detects the database adapter type,
 * builds the schema via `getKuluPayTables()`, and writes the generated schema
 * to a file in the project root.
 *
 * The generator is auto-detected from the runtime database adapter:
 * - Drizzle adapter → generates `pay-schema.ts` (Drizzle table definitions)
 * - Prisma adapter  → generates `prisma/schema.prisma`
 * - SQL adapter     → generates `pay-schema.sql`
 *
 * You can override with --generator drizzle|prisma|sql.
 *
 * After generating, run `npx kulupay migrate` to push the schema to your database
 * using your ORM's native migration tool (drizzle-kit push, prisma db push, etc.).
 *
 * @param opts - Command options including cwd, generator type, output path, and dialect.
 */
async function detectGenerator(options: any): Promise<Generator> {
    if (options.generator && options.generator !== "prisma") {
        return options.generator as Generator;
    }
    const config = await getConfig({
        cwd: path.resolve(options.cwd),
        configPath: options.config,
    });
    if (config?.options?.database) {
        const driver = config.options.database?.handle || config.options.database;
        const kind = driver?.kind || "";
        if (kind === "drizzle") return "drizzle";
        if (kind === "prisma") return "prisma";
        if (kind === "postgres" || kind === "mysql" || kind === "sqlite") return "sql";
    }
    return "prisma";
}

export async function generateAction(opts: any) {
    const options = opts;
    const cwd = path.resolve(options.cwd);
    if (!existsSync(cwd)) {
        console.error(`The directory "${cwd}" does not exist.`);
        process.exit(1);
    }

    const config = await getConfig({ cwd, configPath: options.config });
    if (!config) {
        console.error(
            "No configuration file found. Add a `pay.ts` file to your project or pass the path using the `--config` flag.",
        );
        return;
    }

    const generator = await detectGenerator(options);
    if (!["prisma", "drizzle", "sql"].includes(generator)) {
        console.error(`Unsupported generator: ${generator}. Use prisma, drizzle, or sql.`);
        process.exit(1);
    }

    const dialect = options.dialect || "postgresql";
    const outputFile = options.output || defaultOutput[generator];

    console.log(chalk.cyan("  Generating schema..."));

    const schema = getKuluPayTables(config.options);

    let code = "";
    try {
        if (generator === "prisma") {
            code = renderPrismaSchema(schema, {
                provider: dialect as "postgresql" | "mysql" | "sqlite",
            });
        } else if (generator === "drizzle") {
            const drizzleDialect = dialect === "postgresql" ? "pg" : dialect;
            code = renderDrizzleSchema(schema, {
                dialect: drizzleDialect as "pg" | "mysql" | "sqlite",
            });
        } else if (generator === "sql") {
            code = renderSafeSql(schema, {
                dialect: dialect as "postgres" | "mysql" | "sqlite",
            });
        }
    } catch (e: any) {
        console.error("Failed to generate schema:", e?.message || e);
        process.exit(1);
    }

    if (!code) {
        console.log("Schema is empty. Nothing to generate.");
        process.exit(0);
    }

    const fullPath = path.isAbsolute(outputFile) ? outputFile : path.join(cwd, outputFile);
    const dirExists = existsSync(path.dirname(fullPath));

    let shouldWrite = options.yes;
    if (existsSync(fullPath) && !options.yes) {
        const response = await prompts({
            type: "confirm",
            name: "confirm",
            message: `The file ${chalk.yellow(outputFile)} already exists. Overwrite?`,
            initial: false,
        });
        shouldWrite = response.confirm;
    }

    if (!shouldWrite && !existsSync(fullPath)) {
        shouldWrite = true;
    }

    if (!shouldWrite) {
        console.log("Schema generation cancelled.");
        process.exit(0);
    }

    if (!dirExists) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
    }

    await fs.writeFile(fullPath, code);
    console.log(`🚀 Schema generated successfully at ${chalk.green(outputFile)}`);
    console.log();
    console.log(chalk.gray(`  Next: run ${chalk.cyan("npx kulupay migrate")} to push the schema to your database.`));
    process.exit(0);
}

export const generate = new Command("generate")
    .description("Generate database schema files (Prisma, Drizzle, or SQL) from your KuluPay config")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("--config <config>", "path to your KuluPay config file")
    .option("-o, --output <output>", "output file path")
    .option(
        "-g, --generator <generator>",
        "schema generator: prisma, drizzle, or sql (auto-detected from your database adapter)",
    )
    .option(
        "-d, --dialect <dialect>",
        "database dialect: postgresql, mysql, or sqlite",
        "postgresql",
    )
    .option("-y, --yes", "skip confirmation prompts", false)
    .action(generateAction);
