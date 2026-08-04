import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import { PKG } from "../utils/packages";

export interface KuluPayRegistry {
    $schema: string;
    framework: "nextjs" | "express" | "hono" | "elysia";
    srcDir: boolean;
    configPath: string;
    clientPath: string;
    routePath: string;
    entryFile?: string;
    baseURL: string;
    providers: string[];
    database: {
        type: "memory" | "postgres" | "mysql" | "sqlite" | "prisma" | "drizzle";
    };
}

const REGISTRY_FILE = "kulupay.json";

const FRAMEWORK_OPTIONS = [
    { title: "Next.js", value: "nextjs" },
    { title: "Express", value: "express" },
    { title: "Hono", value: "hono" },
    { title: "Elysia", value: "elysia" },
];

const ROUTER_OPTIONS = [
    { title: "App Router", value: "app" },
    { title: "Pages Router", value: "pages" },
];

const ENTRY_FILE_OPTIONS = [
    { title: "index.ts", value: "index.ts" },
    { title: "server.ts", value: "server.ts" },
    { title: "app.ts", value: "app.ts" },
    { title: "src/index.ts", value: "src/index.ts" },
    { title: "src/server.ts", value: "src/server.ts" },
    { title: "src/app.ts", value: "src/app.ts" },
];

interface ResolvedPaths {
    configPath: string;
    clientPath: string;
    dbPath: string;
    routePath: string;
    entryFile?: string;
}

function resolvePaths(
    framework: string,
    srcDir: boolean,
    router: string,
    entryFile?: string,
): ResolvedPaths {
    const lib = srcDir ? "src/lib" : "lib";

    if (framework === "nextjs") {
        if (router === "pages") {
            const base = srcDir ? "src/pages" : "pages";
            return {
                configPath: `${lib}/pay.ts`,
                clientPath: `${lib}/pay-client.ts`,
                dbPath: `${lib}/db.ts`,
                routePath: `${base}/api/pay/[...kulupay].ts`,
            };
        }
        const base = srcDir ? "src/app" : "app";
        return {
            configPath: `${lib}/pay.ts`,
            clientPath: `${lib}/pay-client.ts`,
            dbPath: `${lib}/db.ts`,
            routePath: `${base}/api/pay/[...kulupay]/route.ts`,
        };
    }

    return {
        configPath: `${lib}/pay.ts`,
        clientPath: `${lib}/pay-client.ts`,
        dbPath: `${lib}/db.ts`,
        routePath: `${lib}/pay-route.ts`,
        entryFile: entryFile || "index.ts",
    };
}

const DATABASE_OPTIONS = [
    { title: "Memory (dev/testing only)", value: "memory" },
    { title: "PostgreSQL", value: "postgres" },
    { title: "MySQL", value: "mysql" },
    { title: "SQLite", value: "sqlite" },
    { title: "Prisma", value: "prisma" },
    { title: "Drizzle ORM", value: "drizzle" },
];

export async function initAction(opts: any) {
    const cwd = path.resolve(opts.cwd);
    if (!existsSync(cwd)) {
        console.error(`The directory "${cwd}" does not exist.`);
        process.exit(1);
    }

    const registryPath = path.join(cwd, REGISTRY_FILE);

    if (existsSync(registryPath) && !opts.yes) {
        const { overwrite } = await prompts({
            type: "confirm",
            name: "overwrite",
            message: `${chalk.yellow(REGISTRY_FILE)} already exists. Overwrite?`,
            initial: false,
        });
        if (!overwrite) {
            console.log("Init cancelled.");
            process.exit(0);
        }
    }

    // Step 1: Framework
    const framework = opts.framework;
    const { selectedFramework } = await prompts({
        type: framework ? null : "select",
        name: "selectedFramework",
        message: "Which framework are you using?",
        choices: FRAMEWORK_OPTIONS,
        initial: 0,
    });
    const fw = framework || selectedFramework;

    // Step 2: Framework-specific questions
    let srcDir = false;
    let router = "app";
    let entryFile: string | undefined;

    const hasSrcDir = existsSync(path.join(cwd, "src"));

    if (fw === "nextjs") {
        const nextResponses = await prompts([
            {
                type: opts.yes ? null : "select",
                name: "router",
                message: "Are you using App Router or Pages Router?",
                choices: ROUTER_OPTIONS,
                initial: 0,
            },
            {
                type: opts.yes ? null : "confirm",
                name: "srcDir",
                message: "Are you using a src/ directory?",
                initial: hasSrcDir,
            },
        ]);
        router = nextResponses.router || "app";
        srcDir = nextResponses.srcDir ?? hasSrcDir;
    } else {
        const entryResponse = await prompts({
            type: opts.yes ? null : "select",
            name: "entryFile",
            message: `Where is your ${fw} entry file?`,
            choices: ENTRY_FILE_OPTIONS,
            initial: 0,
        });
        const entryFileValue = entryResponse.entryFile || "index.ts";
        entryFile = entryFileValue;
        srcDir = entryFileValue.startsWith("src/");
    }

    // Step 3: Database
    const database = opts.database;
    const { selectedDatabase } = await prompts({
        type: database ? null : "select",
        name: "selectedDatabase",
        message: "Which database do you want to use?",
        choices: DATABASE_OPTIONS,
        initial: 0,
    });
    const db = database || selectedDatabase;

    // Step 4: Base URL
    const baseURL = opts.baseURL;
    const { selectedBaseURL } = await prompts({
        type: baseURL || opts.yes ? null : "text",
        name: "selectedBaseURL",
        message: "What is your app's base URL?",
        initial: "http://localhost:3000",
    });
    const finalBaseURL = baseURL || selectedBaseURL || "http://localhost:3000";

    // Resolve all paths
    const paths = resolvePaths(fw, srcDir, router, entryFile);

    // Confirm
    console.log();
    console.log(chalk.gray("  Configuration:"));
    console.log(`    Framework:  ${chalk.cyan(fw)}`);
    if (fw === "nextjs") {
        console.log(`    Router:      ${chalk.cyan(router === "app" ? "App Router" : "Pages Router")}`);
        console.log(`    src/ dir:    ${chalk.cyan(srcDir ? "Yes" : "No")}`);
    } else {
        console.log(`    Entry file:  ${chalk.cyan(paths.entryFile || "index.ts")}`);
    }
    console.log(`    Database:    ${chalk.cyan(db)}`);
    console.log(`    Base URL:    ${chalk.cyan(finalBaseURL)}`);
    console.log();
    console.log(chalk.gray("  Files that will be created:"));
    console.log(`    ${chalk.cyan(REGISTRY_FILE)}`);
    console.log(`    ${chalk.cyan(paths.configPath)}`);
    console.log(`    ${chalk.cyan(paths.dbPath)}`);
    console.log(`    ${chalk.cyan(paths.clientPath)}`);
    if (fw === "nextjs") {
        console.log(`    ${chalk.cyan(paths.routePath)}`);
    } else {
        console.log(`    ${chalk.cyan(paths.routePath)} ${chalk.gray("(import this in your entry file)")}`);
    }
    console.log();

    if (!opts.yes) {
        const { confirm } = await prompts({
            type: "confirm",
            name: "confirm",
            message: "Proceed with these settings?",
            initial: true,
        });
        if (!confirm) {
            console.log("Init cancelled.");
            process.exit(0);
        }
    }

    console.log(chalk.cyan("  Initializing KuluPay..."));

    const registry: KuluPayRegistry = {
        $schema: "https://kulupay.dev/schema.json",
        framework: fw as KuluPayRegistry["framework"],
        srcDir,
        configPath: paths.configPath,
        clientPath: paths.clientPath,
        routePath: paths.routePath,
        ...(paths.entryFile ? { entryFile: paths.entryFile } : {}),
        baseURL: finalBaseURL,
        providers: [],
        database: {
            type: db as KuluPayRegistry["database"]["type"],
        },
    };

    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

    // Create db file
    const dbFullPath = path.join(cwd, paths.dbPath);
    await fs.mkdir(path.dirname(dbFullPath), { recursive: true });
    await fs.writeFile(dbFullPath, generateDbFile(registry));

    // Create server config
    const configFullPath = path.join(cwd, registry.configPath);
    await fs.mkdir(path.dirname(configFullPath), { recursive: true });
    await fs.writeFile(configFullPath, generateConfigFile(registry));

    // Create client config
    const clientFullPath = path.join(cwd, registry.clientPath);
    await fs.mkdir(path.dirname(clientFullPath), { recursive: true });
    await fs.writeFile(clientFullPath, generateClientFile(registry));

    // Create route file
    const routeFullPath = path.join(cwd, registry.routePath);
    await fs.mkdir(path.dirname(routeFullPath), { recursive: true });

    if (fw === "nextjs") {
        await fs.writeFile(routeFullPath, generateNextJsRoute(registry));
    } else {
        await fs.writeFile(routeFullPath, generateServerRoute(registry));
    }

    console.log();
    console.log(chalk.green("  KuluPay initialized successfully!"));
    console.log();
    console.log(chalk.gray("  Files created:"));
    console.log(`    ${chalk.cyan(REGISTRY_FILE)}`);
    console.log(`    ${chalk.cyan(registry.configPath)}`);
    console.log(`    ${chalk.cyan(paths.dbPath)}`);
    console.log(`    ${chalk.cyan(registry.clientPath)}`);
    console.log(`    ${chalk.cyan(registry.routePath)}`);
    console.log();
    if (fw !== "nextjs") {
        console.log(chalk.yellow(`  ⚠ Add this to your entry file (${registry.entryFile}):`));
        console.log();
        console.log(chalk.gray(`    import { payRoute } from "./lib/pay-route";`));
        console.log();
        console.log(chalk.gray(`    // ${fw} mount example:`));
        if (fw === "express") {
            console.log(chalk.gray(`    app.use('/api/pay', payRoute);`));
        } else if (fw === "hono") {
            console.log(chalk.gray(`    app.route('/api/pay', payRoute);`));
        } else if (fw === "elysia") {
            console.log(chalk.gray(`    app.use('/api/pay', payRoute);`));
        }
        console.log();
    }
    console.log(chalk.gray("  Next steps:"));

    if (db !== "memory") {
        console.log(`    ${chalk.white("1.")} Install database dependencies:`);
        if (db === "postgres") {
            console.log(`       ${chalk.cyan(`npm install ${PKG.adapterSql} pg`)}`);
            console.log(`       ${chalk.gray(`# or: pnpm add ${PKG.adapterSql} pg`)}`);
        } else if (db === "mysql") {
            console.log(`       ${chalk.cyan(`npm install ${PKG.adapterSql} mysql2`)}`);
            console.log(`       ${chalk.gray(`# or: pnpm add ${PKG.adapterSql} mysql2`)}`);
        } else if (db === "sqlite") {
            console.log(`       ${chalk.cyan(`npm install ${PKG.adapterSql} better-sqlite3`)}`);
            console.log(`       ${chalk.gray(`# or: pnpm add ${PKG.adapterSql} better-sqlite3`)}`);
        } else if (db === "prisma") {
            console.log(`       ${chalk.cyan(`npm install ${PKG.adapterPrisma} @prisma/client`)}`);
            console.log(`       ${chalk.gray(`# or: pnpm add ${PKG.adapterPrisma} @prisma/client`)}`);
        } else if (db === "drizzle") {
            console.log(`       ${chalk.cyan(`npm install ${PKG.adapterDrizzle} drizzle-orm pg`)}`);
            console.log(`       ${chalk.gray(`# or: pnpm add ${PKG.adapterDrizzle} drizzle-orm pg`)}`);
        }
        console.log();
        console.log(`    ${chalk.white("2.")} Set environment variables:`);
        if (db === "postgres" || db === "mysql" || db === "prisma" || db === "drizzle") {
            console.log(`       ${chalk.cyan("DATABASE_URL=your_connection_string")}`);
        } else if (db === "sqlite") {
            console.log(`       ${chalk.gray("# No env variable needed for SQLite file path")}`);
        }
        console.log();
        console.log(`    ${chalk.white("3.")} Add a provider:  ${chalk.cyan("npx kulupay add-provider stripe")}`);
        console.log(`    ${chalk.white("4.")} Generate schema: ${chalk.cyan("npx kulupay generate")}`);
        console.log(`    ${chalk.white("5.")} Run migration:   ${chalk.cyan("npx kulupay migrate")}`);
    } else {
        console.log(`    ${chalk.white("1.")} Add a provider:  ${chalk.cyan("npx kulupay add-provider stripe")}`);
        console.log(`    ${chalk.white("2.")} Generate schema: ${chalk.cyan("npx kulupay generate")}`);
        console.log(`    ${chalk.white("3.")} Run migration:   ${chalk.cyan("npx kulupay migrate")}`);
    }
    console.log();
}

function generateDbFile(registry: KuluPayRegistry): string {
    const db = registry.database.type;

    if (db === "memory") {
        return `import { createMemoryDriver } from "@farming-labs/orm";

export const database = createMemoryDriver();
`;
    }

    if (db === "postgres") {
        return `import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});
`;
    }

    if (db === "mysql") {
        return `import mysql from "mysql2/promise";

export const connection = await mysql.createConnection(
  process.env.DATABASE_URL!,
);
`;
    }

    if (db === "sqlite") {
        return `import Database from "better-sqlite3";

export const sqliteDb = new Database("kulupay.db");
`;
    }

    if (db === "prisma") {
        return `import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
`;
    }

    // drizzle
    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const db = drizzle(
  new Pool({ connectionString: process.env.DATABASE_URL! }),
);
`;
}

function generateConfigFile(registry: KuluPayRegistry): string {
    const providersArray = registry.providers.length > 0
        ? `[\n    ${registry.providers.map(p => providerImportLine(p)).join(",\n    ")},\n  ]`
        : `[]`;

    const db = registry.database.type;

    let dbImport = "";
    let dbLine = "";

    if (db === "memory") {
        dbImport = `import { database } from "./db";`;
        dbLine = `  database,`;
    } else if (db === "postgres") {
        dbImport = `import { pg } from "${PKG.adapterSql}";\nimport { pool } from "./db";`;
        dbLine = `  database: pg(pool),`;
    } else if (db === "mysql") {
        dbImport = `import { mysql } from "${PKG.adapterSql}";\nimport { connection } from "./db";`;
        dbLine = `  database: mysql(connection),`;
    } else if (db === "sqlite") {
        dbImport = `import { sqlite } from "${PKG.adapterSql}";\nimport { sqliteDb } from "./db";`;
        dbLine = `  database: sqlite(sqliteDb),`;
    } else if (db === "prisma") {
        dbImport = `import { prismaAdapter } from "${PKG.adapterPrisma}";\nimport { prisma } from "./db";`;
        dbLine = `  database: prismaAdapter(prisma, { provider: "postgresql" }),`;
    } else if (db === "drizzle") {
        dbImport = `import { drizzleAdapter } from "${PKG.adapterDrizzle}";\nimport { db } from "./db";`;
        dbLine = `  database: drizzleAdapter(db, { provider: "pg" }),`;
    }

    return `import { kuluPay } from "${PKG.kulupay}";
${dbImport}
${registry.providers.map(p => providerImportLine(p, true)).join("\n")}
export const pay = kuluPay({
${dbLine}
  providers: ${providersArray},
  baseURL: process.env.KULUPAY_URL ?? "${registry.baseURL}",
  debug: true,
});
`;
}

function providerImportLine(providerId: string, isImport = false): string {
    switch (providerId) {
        case "stripe":
            return isImport
                ? `import { stripe } from "${PKG.kulupay}/providers/stripe";`
                : `stripe({\n      apiKey: process.env.STRIPE_API_KEY!,\n      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,\n    })`;
        case "chapa":
            return isImport
                ? `import { chapa } from "${PKG.kulupay}/providers/chapa";`
                : `chapa({\n      apiKey: process.env.CHAPA_API_KEY!,\n      webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,\n    })`;
        case "paypal":
            return isImport
                ? `import { paypal } from "${PKG.kulupay}/providers/paypal";`
                : `paypal({\n      clientId: process.env.PAYPAL_CLIENT_ID!,\n      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,\n    })`;
        default:
            return isImport ? "" : `// Unknown provider: ${providerId}`;
    }
}

function generateClientFile(registry: KuluPayRegistry): string {
    const hasStripe = registry.providers.includes("stripe");
    const hasChapa = registry.providers.includes("chapa");
    const hasEVM = registry.providers.some((p) => p.startsWith("evm-"));
    const hasTron = registry.providers.some((p) => p.startsWith("tron-"));

    const stripeImport = hasStripe
        ? `import { createStripeClientProvider } from "${PKG.kulupay}/client/providers";\n`
        : "";
    const stripeExport = hasStripe
        ? `\nexport const stripeProvider = createStripeClientProvider({\n  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",\n});\n`
        : "";
    const chapaImport = hasChapa
        ? `import { createChapaClientProvider } from "${PKG.kulupay}/client/providers";\n`
        : "";
    const chapaExport = hasChapa
        ? `\nexport const chapaProvider = createChapaClientProvider();\n`
        : "";
    const evmImport = hasEVM
        ? `import { createEVMClientProvider } from "${PKG.kulupay}/client/providers";\n`
        : "";
    const evmExport = hasEVM
        ? `\nexport const evmProvider = createEVMClientProvider();\n`
        : "";
    const tronImport = hasTron
        ? `import { createTronClientProvider } from "${PKG.kulupay}/client/providers";\n`
        : "";
    const tronExport = hasTron
        ? `\nexport const tronProvider = createTronClientProvider();\n`
        : "";

    return `import { createPayClient } from "${PKG.kulupay}/client";
${stripeImport}${chapaImport}${evmImport}${tronImport}
export const payClient = createPayClient({
  baseURL: "",
  basePath: "/api/pay",
});
${stripeExport}${chapaExport}${evmExport}${tronExport}`;
}

function generateNextJsRoute(registry: KuluPayRegistry): string {
    const importPath = registry.configPath.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
    return `import { toNextJsHandler } from "${PKG.kulupay}/next-js";
import { pay } from "@/${importPath}";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(pay);
`;
}

function generateServerRoute(registry: KuluPayRegistry): string {
    const importPath = registry.configPath.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
    const relativePath = `./${importPath}`;

    if (registry.framework === "express") {
        return `import { Router } from "express";
import { toExpressHandler } from "${PKG.kulupay}";
import { pay } from "${relativePath}";

export const payRoute = Router();
payRoute.all("/*", toExpressHandler(pay));
`;
    }

    if (registry.framework === "hono") {
        return `import { Hono } from "hono";
import { toHonoHandler } from "${PKG.kulupay}";
import { pay } from "${relativePath}";

export const payRoute = new Hono();
payRoute.all("/*", toHonoHandler(pay));
`;
    }

    return `import { Elysia } from "elysia";
import { toElysiaHandler } from "${PKG.kulupay}";
import { pay } from "${relativePath}";

export const payRoute = new Elysia();
payRoute.all("/*", toElysiaHandler(pay));
`;
}

export const init = new Command("init")
    .description("Initialize KuluPay in your project (creates kulupay.json + config files)")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("-f, --framework <framework>", "framework: nextjs, express, hono, or elysia")
    .option("-d, --database <database>", "database: memory, postgres, mysql, sqlite, prisma, or drizzle")
    .option("--baseURL <baseURL>", "your app's base URL")
    .option("-y, --yes", "skip confirmation prompts", false)
    .action(initAction);
