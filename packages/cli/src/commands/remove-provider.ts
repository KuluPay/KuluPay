import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import yoctoSpinner from "yocto-spinner";
import type { KuluPayRegistry } from "./init";
import { PKG } from "../utils/packages";

const REGISTRY_FILE = "kulupay.json";

const PROVIDER_NAMES: Record<string, string> = {
    stripe: "Stripe",
    chapa: "Chapa",
    paypal: "PayPal",
};

const PROVIDER_ENV_VARS: Record<string, string[]> = {
    stripe: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    chapa: ["CHAPA_API_KEY", "CHAPA_WEBHOOK_SECRET"],
    paypal: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
};

const PROVIDER_IMPORTS: Record<string, string> = {
    stripe: `import { stripe } from "${PKG.kulupay}/providers";`,
    chapa: `import { chapa } from "${PKG.kulupay}/providers";`,
    paypal: `import { paypal } from "${PKG.kulupay}/providers";`,
};

const PROVIDER_CLIENT_IMPORTS: Record<string, string> = {
    stripe: `import { createStripeClientProvider } from "${PKG.kulupay}/client/providers";`,
    chapa: `import { createChapaClientProvider } from "${PKG.kulupay}/client/providers";`,
    "evm-eth": `import { createEVMClientProvider } from "${PKG.kulupay}/client/providers";`,
    "evm-base-usdc": `import { createEVMClientProvider } from "${PKG.kulupay}/client/providers";`,
    "tron-trx": `import { createTronClientProvider } from "${PKG.kulupay}/client/providers";`,
    "tron-usdt": `import { createTronClientProvider } from "${PKG.kulupay}/client/providers";`,
};

const PROVIDER_CLIENT_EXPORTS: Record<string, RegExp> = {
    stripe: /export\s+const\s+stripeProvider\s*=\s*createStripeClientProvider\([\s\S]*?\);\s*/g,
    chapa: /export\s+const\s+chapaProvider\s*=\s*createChapaClientProvider\([\s\S]*?\);\s*/g,
    "evm-eth": /export\s+const\s+evmProvider\s*=\s*createEVMClientProvider\([\s\S]*?\);\s*/g,
    "evm-base-usdc": /export\s+const\s+evmProvider\s*=\s*createEVMClientProvider\([\s\S]*?\);\s*/g,
    "tron-trx": /export\s+const\s+tronProvider\s*=\s*createTronClientProvider\([\s\S]*?\);\s*/g,
    "tron-usdt": /export\s+const\s+tronProvider\s*=\s*createTronClientProvider\([\s\S]*?\);\s*/g,
};

export async function removeProviderAction(opts: any) {
    const cwd = path.resolve(opts.cwd);
    if (!existsSync(cwd)) {
        console.error(`The directory "${cwd}" does not exist.`);
        process.exit(1);
    }

    const registryPath = path.join(cwd, REGISTRY_FILE);
    if (!existsSync(registryPath)) {
        console.error(
            `${chalk.red("No kulupay.json found.")} Run ${chalk.cyan("npx kulupay init")} first.`,
        );
        process.exit(1);
    }

    const registry: KuluPayRegistry = JSON.parse(
        await fs.readFile(registryPath, "utf-8"),
    );

    let providerId = opts.provider;
    if (!providerId) {
        if (registry.providers.length === 0) {
            console.log(chalk.yellow("No providers configured. Nothing to remove."));
            process.exit(0);
        }
        const { selected } = await prompts({
            type: "select",
            name: "selected",
            message: "Which provider do you want to remove?",
            choices: registry.providers.map((id) => ({
                title: PROVIDER_NAMES[id] || id,
                value: id,
            })),
        });
        providerId = selected;
    }

    if (!providerId) {
        console.log("Cancelled.");
        process.exit(0);
    }

    if (!registry.providers.includes(providerId)) {
        console.error(
            `${chalk.red(PROVIDER_NAMES[providerId] || providerId)} is not in your providers list.`,
        );
        console.log(chalk.gray(`Current providers: ${registry.providers.join(", ") || "none"}`));
        process.exit(1);
    }

    let shouldRemove = opts.yes;
    if (!shouldRemove) {
        const { confirm } = await prompts({
            type: "confirm",
            name: "confirm",
            message: `Remove ${chalk.yellow(PROVIDER_NAMES[providerId] || providerId)}? This will remove it from your config, client, and env vars.`,
            initial: false,
        });
        shouldRemove = confirm;
    }

    if (!shouldRemove) {
        console.log("Cancelled.");
        process.exit(0);
    }

    const spinner = yoctoSpinner({ text: `Removing ${PROVIDER_NAMES[providerId] || providerId}...` }).start();

    // 1. Remove from registry
    registry.providers = registry.providers.filter((p) => p !== providerId);
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

    // 2. Remove from server config (pay.ts)
    const configPath = path.join(cwd, registry.configPath);
    if (existsSync(configPath)) {
        const content = await fs.readFile(configPath, "utf-8");
        const updated = removeFromServerConfig(content, providerId);
        if (updated !== content) {
            await fs.writeFile(configPath, updated);
        }
    }

    // 3. Remove from client config (pay-client.ts)
    const clientPaths = [
        path.join(cwd, "lib/pay-client.ts"),
        path.join(cwd, "src/lib/pay-client.ts"),
        path.join(cwd, "pay-client.ts"),
    ];
    for (const clientPath of clientPaths) {
        if (existsSync(clientPath)) {
            const content = await fs.readFile(clientPath, "utf-8");
            const updated = removeFromClientConfig(content, providerId);
            if (updated !== content) {
                await fs.writeFile(clientPath, updated);
            }
        }
    }

    // 4. Remove env vars (unless --keep-env)
    if (!opts.keepEnv) {
        const envPath = path.join(cwd, ".env.local");
        if (existsSync(envPath)) {
            const content = await fs.readFile(envPath, "utf-8");
            const envVars = PROVIDER_ENV_VARS[providerId] || [];
            const lines = content.split("\n");
            const filtered = lines.filter(
                (line) => !envVars.some((key) => line.startsWith(`${key}=`)),
            );
            await fs.writeFile(envPath, filtered.join("\n"));
        }
    }

    spinner.stop();

    console.log();
    console.log(chalk.green(`  ${PROVIDER_NAMES[providerId] || providerId} removed successfully!`));
    console.log();
    console.log(chalk.gray("  What was done:"));
    console.log(`    ${chalk.cyan("✓")} Removed from ${chalk.white("kulupay.json")} providers list`);
    console.log(`    ${chalk.cyan("✓")} Removed provider from ${chalk.white(registry.configPath)}`);
    const clientRemoved = clientPaths.some((p) => existsSync(p));
    if (clientRemoved) {
        console.log(`    ${chalk.cyan("✓")} Removed client provider from ${chalk.white("pay-client.ts")}`);
    }
    if (!opts.keepEnv) {
        console.log(`    ${chalk.cyan("✓")} Removed env vars from ${chalk.white(".env.local")}`);
    }
    console.log();
    console.log(chalk.gray("  You can now uninstall npm packages if no longer needed:"));
    const packages: Record<string, string[]> = {
        stripe: ["stripe", "@stripe/stripe-js"],
        chapa: [],
        paypal: ["@paypal/paypal-js"],
    };
    const pkgs = packages[providerId];
    if (pkgs && pkgs.length > 0) {
        console.log(`    ${chalk.cyan(`pnpm remove ${pkgs.join(" ")}`)}`);
    }
    console.log();
}

function removeFromServerConfig(content: string, providerId: string): string {
    // Remove the import line
    const importLine = PROVIDER_IMPORTS[providerId];
    if (importLine && content.includes(importLine)) {
        content = content.replace(importLine + "\n", "");
        content = content.replace(importLine, "");
    }

    // Remove the provider from the providers array
    // Match patterns like: stripe({ ... }),  or stripe({ ... })
    const providerFnName = providerId;
    const patterns = [
        // Match: stripe({\n      ...\n    }),
        new RegExp(`\\s*${providerFnName}\\(\\{[\\s\\S]*?\\}\\),?\\n`, "g"),
        // Match: stripe({...}), (single line)
        new RegExp(`\\s*${providerFnName}\\(\\{[^}]*\\}\\),?`, "g"),
    ];

    for (const pattern of patterns) {
        content = content.replace(pattern, "");
    }

    // Clean up empty providers array: providers: [\n  ] → providers: []
    content = content.replace(/providers:\s*\[\s*\]/g, "providers: []");
    // Clean up trailing comma in providers array
    content = content.replace(/providers:\s*\[\s*,/g, "providers: [");

    return content;
}

function removeFromClientConfig(content: string, providerId: string): string {
    // Remove client import
    const clientImport = PROVIDER_CLIENT_IMPORTS[providerId];
    if (clientImport && content.includes(clientImport)) {
        content = content.replace(clientImport + "\n", "");
        content = content.replace(clientImport, "");
    }

    // Remove client export block
    const clientExportRegex = PROVIDER_CLIENT_EXPORTS[providerId];
    if (clientExportRegex) {
        content = content.replace(clientExportRegex, "");
    }

    // Clean up extra blank lines
    content = content.replace(/\n{3,}/g, "\n\n");

    return content;
}

export const removeProvider = new Command("remove-provider")
    .description("Remove a payment provider from your KuluPay project")
    .argument("[provider]", "provider id: stripe, chapa, or paypal")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("-y, --yes", "skip confirmation prompt", false)
    .option("--keep-env", "keep env vars in .env.local", false)
    .action((provider: string | undefined, opts: any) => {
        return removeProviderAction({ ...opts, provider });
    });
