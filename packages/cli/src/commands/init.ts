import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import yoctoSpinner from "yocto-spinner";

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
        type: "memory" | "postgres" | "mysql" | "sqlite";
        url?: string;
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
                routePath: `${base}/api/pay/[...kulupay].ts`,
            };
        }
        const base = srcDir ? "src/app" : "app";
        return {
            configPath: `${lib}/pay.ts`,
            clientPath: `${lib}/pay-client.ts`,
            routePath: `${base}/api/pay/[...kulupay]/route.ts`,
        };
    }

    return {
        configPath: `${lib}/pay.ts`,
        clientPath: `${lib}/pay-client.ts`,
        routePath: `${lib}/pay-route.ts`,
        entryFile: entryFile || "index.ts",
    };
}

const DATABASE_OPTIONS = [
    { title: "Memory (dev/testing only)", value: "memory" },
    { title: "PostgreSQL", value: "postgres" },
    { title: "MySQL", value: "mysql" },
    { title: "SQLite", value: "sqlite" },
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

    if (fw === "nextjs") {
        const nextResponses = await prompts([
            {
                type: "select",
                name: "router",
                message: "Are you using App Router or Pages Router?",
                choices: ROUTER_OPTIONS,
                initial: 0,
            },
            {
                type: "confirm",
                name: "srcDir",
                message: "Are you using a src/ directory?",
                initial: existsSync(path.join(cwd, "src")),
            },
        ]);
        router = nextResponses.router || "app";
        srcDir = nextResponses.srcDir ?? false;
    } else {
        const entryResponse = await prompts({
            type: "select",
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

    let databaseUrl: string | undefined;
    if (db === "postgres" || db === "mysql") {
        const { url } = await prompts({
            type: "text",
            name: "url",
            message: db === "postgres"
                ? "PostgreSQL connection string (e.g. postgresql://user:pass@host/db)"
                : "MySQL connection string (e.g. mysql://user:pass@host/db)",
        });
        databaseUrl = url;
    }

    // Step 4: Base URL
    const baseURL = opts.baseURL;
    const { selectedBaseURL } = await prompts({
        type: baseURL ? null : "text",
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

    const spinner = yoctoSpinner({ text: "Initializing KuluPay..." }).start();

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
            ...(databaseUrl ? { url: databaseUrl } : {}),
        },
    };

    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

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

    spinner.stop();

    console.log();
    console.log(chalk.green("  KuluPay initialized successfully!"));
    console.log();
    console.log(chalk.gray("  Files created:"));
    console.log(`    ${chalk.cyan(REGISTRY_FILE)}`);
    console.log(`    ${chalk.cyan(registry.configPath)}`);
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
    console.log(`    ${chalk.white("1.")} Add a provider:  ${chalk.cyan("npx kulupay add-provider stripe")}`);
    console.log(`    ${chalk.white("2.")} Generate schema: ${chalk.cyan("npx kulupay generate")}`);
    console.log(`    ${chalk.white("3.")} Run migration:   ${chalk.cyan("npx kulupay migrate")}`);
    console.log();
}

function generateConfigFile(registry: KuluPayRegistry): string {
    const dbDriverImport = registry.database.type === "memory"
        ? "createMemoryDriver"
        : registry.database.type === "postgres"
        ? "createPgPoolDriver"
        : registry.database.type === "mysql"
        ? "createMysqlDriver"
        : "createSqliteDriver";

    const dbLine = registry.database.type === "memory"
        ? `const database = createMemoryDriver();`
        : registry.database.type === "postgres"
        ? `import { Pool } from "pg";\n\nconst database = createPgPoolDriver(\n  new Pool({ connectionString: process.env.DATABASE_URL! }),\n);`
        : registry.database.type === "mysql"
        ? `import mysql from "mysql2/promise";\n\nconst database = createMysqlDriver(\n  await mysql.createConnection(process.env.DATABASE_URL!),\n);`
        : `const database = createSqliteDriver("kulupay.db");`;

    const providersArray = registry.providers.length > 0
        ? `[\n    ${registry.providers.map(p => providerImportLine(p)).join(",\n    ")},\n  ]`
        : `[]`;

    return `import { kuluPay, ${dbDriverImport} } from "@kulupay/kulupay";
${registry.providers.map(p => providerImportLine(p, true)).join("\n")}
${dbLine}

export const pay = kuluPay({
  database,
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
                ? `import { stripe } from "@kulupay/kulupay/providers/stripe";`
                : `stripe({\n      apiKey: process.env.STRIPE_API_KEY!,\n      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,\n    })`;
        case "chapa":
            return isImport
                ? `import { chapa } from "@kulupay/kulupay/providers/chapa";`
                : `chapa({\n      apiKey: process.env.CHAPA_API_KEY!,\n      webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,\n    })`;
        case "paypal":
            return isImport
                ? `import { paypal } from "@kulupay/kulupay/providers/paypal";`
                : `paypal({\n      clientId: process.env.PAYPAL_CLIENT_ID!,\n      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,\n    })`;
        default:
            return isImport ? "" : `// Unknown provider: ${providerId}`;
    }
}

function generateClientFile(registry: KuluPayRegistry): string {
    const hasStripe = registry.providers.includes("stripe");
    const stripeImport = hasStripe
        ? `import { createStripeClientProvider } from "@kulupay/kulupay/client/providers";\n`
        : "";
    const stripeExport = hasStripe
        ? `\nexport const stripeProvider = createStripeClientProvider({\n  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",\n});\n`
        : "";

    return `import { createKuluPayClient } from "@kulupay/kulupay/client";
${stripeImport}
export const payClient = createKuluPayClient({
  baseURL: "/api/pay",
});
${stripeExport}`;
}

function generateNextJsRoute(registry: KuluPayRegistry): string {
    const importPath = registry.configPath.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
    return `import { toNextJsHandler } from "@kulupay/kulupay/next-js";
import { pay } from "@/${importPath}";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(pay);
`;
}

function generateServerRoute(registry: KuluPayRegistry): string {
    const importPath = registry.configPath.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
    const relativePath = `./${importPath}`;

    if (registry.framework === "express") {
        return `import { Router } from "express";
import { toExpressHandler } from "@kulupay/kulupay";
import { pay } from "${relativePath}";

export const payRoute = Router();
payRoute.all("/*", toExpressHandler(pay));
`;
    }

    if (registry.framework === "hono") {
        return `import { Hono } from "hono";
import { toHonoHandler } from "@kulupay/kulupay";
import { pay } from "${relativePath}";

export const payRoute = new Hono();
payRoute.all("/*", toHonoHandler(pay));
`;
    }

    return `import { Elysia } from "elysia";
import { toElysiaHandler } from "@kulupay/kulupay";
import { pay } from "${relativePath}";

export const payRoute = new Elysia();
payRoute.all("/*", toElysiaHandler(pay));
`;
}

export const init = new Command("init")
    .description("Initialize KuluPay in your project (creates kulupay.json + config files)")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("-f, --framework <framework>", "framework: nextjs, express, hono, or elysia")
    .option("-d, --database <database>", "database: memory, postgres, mysql, or sqlite")
    .option("--baseURL <baseURL>", "your app's base URL")
    .option("-y, --yes", "skip confirmation prompts", false)
    .action(initAction);
