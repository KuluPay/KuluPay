import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import yoctoSpinner from "yocto-spinner";
import type { KuluPayRegistry } from "./init";

const REGISTRY_FILE = "kulupay.json";

interface ProviderDefinition {
    id: string;
    name: string;
    description: string;
    npmPackages: string[];
    envVars: { key: string; description: string; required: boolean; public?: boolean }[];
    configSnippet: (opts: { envPrefix: string }) => string;
    clientSnippet?: string;
}

const PROVIDERS: Record<string, ProviderDefinition> = {
    stripe: {
        id: "stripe",
        name: "Stripe",
        description: "Accept cards, Apple Pay, Google Pay, and more via Stripe",
        npmPackages: ["stripe", "@stripe/stripe-js"],
        envVars: [
            { key: "STRIPE_API_KEY", description: "Stripe secret key (sk_test_...)", required: true },
            { key: "STRIPE_WEBHOOK_SECRET", description: "Stripe webhook secret (whsec_...)", required: false },
            { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", description: "Stripe publishable key (pk_test_...)", required: true, public: true },
        ],
        configSnippet: ({ envPrefix }) =>
            `stripe({\n      apiKey: process.env.${envPrefix}API_KEY!,\n      webhookSecret: process.env.${envPrefix}WEBHOOK_SECRET,\n    })`,
        clientSnippet: `import { createStripeClientProvider } from "@kulupay/kulupay/client/providers";

export const stripeProvider = createStripeClientProvider({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
});`,
    },
    chapa: {
        id: "chapa",
        name: "Chapa",
        description: "Ethiopian payment gateway — accept local payment methods",
        npmPackages: [],
        envVars: [
            { key: "CHAPA_API_KEY", description: "Chapa API key", required: true },
            { key: "CHAPA_WEBHOOK_SECRET", description: "Chapa webhook secret", required: false },
        ],
        configSnippet: ({ envPrefix }) =>
            `chapa({\n      apiKey: process.env.${envPrefix}API_KEY!,\n      webhookSecret: process.env.${envPrefix}WEBHOOK_SECRET,\n    })`,
    },
    paypal: {
        id: "paypal",
        name: "PayPal",
        description: "Accept PayPal payments globally",
        npmPackages: ["@paypal/paypal-js"],
        envVars: [
            { key: "PAYPAL_CLIENT_ID", description: "PayPal client ID", required: true },
            { key: "PAYPAL_CLIENT_SECRET", description: "PayPal client secret", required: true },
        ],
        configSnippet: ({ envPrefix }) =>
            `paypal({\n      clientId: process.env.${envPrefix}CLIENT_ID!,\n      clientSecret: process.env.${envPrefix}CLIENT_SECRET!,\n    })`,
    },
};

export async function addProviderAction(opts: any) {
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
        const available = Object.values(PROVIDERS).filter(
            (p) => !registry.providers.includes(p.id),
        );
        if (available.length === 0) {
            console.log(chalk.yellow("All available providers are already added."));
            process.exit(0);
        }
        const { selected } = await prompts({
            type: "select",
            name: "selected",
            message: "Which provider do you want to add?",
            choices: available.map((p) => ({
                title: `${p.name} — ${chalk.gray(p.description)}`,
                value: p.id,
            })),
        });
        providerId = selected;
    }

    if (!providerId) {
        console.log("Cancelled.");
        process.exit(0);
    }

    const provider = PROVIDERS[providerId];
    if (!provider) {
        console.error(
            `Unknown provider: ${chalk.red(providerId)}. Available: ${Object.keys(PROVIDERS).join(", ")}`,
        );
        process.exit(1);
    }

    if (registry.providers.includes(providerId) && !opts.force) {
        const { overwrite } = await prompts({
            type: "confirm",
            name: "overwrite",
            message: `${chalk.yellow(provider.name)} is already added. Reconfigure?`,
            initial: false,
        });
        if (!overwrite) {
            console.log("Cancelled.");
            process.exit(0);
        }
    }

    const envPrefix = providerId.toUpperCase() + "_";

    const spinner = yoctoSpinner({ text: `Adding ${provider.name}...` }).start();

    if (!registry.providers.includes(providerId)) {
        registry.providers.push(providerId);
    }

    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

    const configPath = path.join(cwd, registry.configPath);
    if (existsSync(configPath)) {
        const configContent = await fs.readFile(configPath, "utf-8");
        const updatedConfig = updateConfigWithProvider(configContent, provider, envPrefix);
        if (updatedConfig !== configContent) {
            await fs.writeFile(configPath, updatedConfig);
        }
    }

    const envPath = path.join(cwd, ".env.local");
    let envContent = "";
    if (existsSync(envPath)) {
        envContent = await fs.readFile(envPath, "utf-8");
    }
    const envAdditions: string[] = [];
    const providerDocsLinks: Record<string, string> = {
        stripe: "https://dashboard.stripe.com/apikeys",
        chapa: "https://dashboard.chapa.co/settings/api-keys",
        paypal: "https://developer.paypal.com/dashboard/applications/live",
    };
    for (const envVar of provider.envVars) {
        if (!envContent.includes(envVar.key)) {
            const placeholder = envVar.public ? "your_key_here" : "your_secret_here";
            envAdditions.push(`${envVar.key}=${placeholder}`);
        }
    }
    if (envAdditions.length > 0) {
        const separator = envContent && !envContent.endsWith("\n") ? "\n" : "";
        await fs.writeFile(
            envPath,
            envContent + separator + envAdditions.join("\n") + "\n",
        );
    }

    if (provider.clientSnippet) {
        const clientPath = path.join(cwd, registry.clientPath || "lib/pay-client.ts");
        if (existsSync(clientPath)) {
            const clientContent = await fs.readFile(clientPath, "utf-8");
            if (!clientContent.includes(`createStripeClientProvider`) && providerId === "stripe") {
                const updated = clientContent + "\n" + provider.clientSnippet + "\n";
                await fs.writeFile(clientPath, updated);
            }
        }
    }

    spinner.stop();

    console.log();
    console.log(chalk.green(`  ${provider.name} added successfully!`));
    console.log();
    console.log(chalk.gray("  What was done:"));
    console.log(`    ${chalk.cyan("✓")} Added to ${chalk.white("kulupay.json")} providers list`);
    console.log(`    ${chalk.cyan("✓")} Updated ${chalk.white(registry.configPath)} with provider config`);
    if (envAdditions.length > 0) {
        console.log(`    ${chalk.cyan("✓")} Added env var placeholders to ${chalk.white(".env.local")}`);
    }
    if (provider.clientSnippet) {
        console.log(`    ${chalk.cyan("✓")} Added client provider to ${chalk.white(registry.clientPath || "lib/pay-client.ts")}`);
    }
    console.log();
    if (envAdditions.length > 0) {
        console.log(chalk.yellow(`  ⚠ Fill in your real keys in ${chalk.white(".env.local")}:`));
        for (const envVar of provider.envVars) {
            console.log(`    ${chalk.gray(envVar.key)} — ${envVar.description}`);
        }
        const docsLink = providerDocsLinks[providerId];
        if (docsLink) {
            console.log(`    ${chalk.gray(`Get them from: ${chalk.cyan(docsLink)}`)}`);
        }
        console.log();
    }
    if (provider.npmPackages.length > 0) {
        console.log(chalk.gray("  Install required packages:"));
        console.log(`    ${chalk.cyan(`pnpm add ${provider.npmPackages.join(" ")}`)}`);
        console.log();
    }
    console.log(chalk.gray("  Next steps:"));
    console.log(`    ${chalk.white("1.")} Fill in your keys in ${chalk.cyan(".env.local")}`);
    console.log(`    ${chalk.white("2.")} Generate schema: ${chalk.cyan("npx kulupay generate")}`);
    console.log(`    ${chalk.white("3.")} Run migration:   ${chalk.cyan("npx kulupay migrate")}`);
    console.log();
}

function updateConfigWithProvider(
    content: string,
    provider: ProviderDefinition,
    envPrefix: string,
): string {
    const importLine = providerImportLine(provider.id);
    if (importLine && !content.includes(importLine)) {
        const firstImportEnd = content.indexOf("\n", content.indexOf("import"));
        if (firstImportEnd !== -1) {
            content =
                content.slice(0, firstImportEnd + 1) +
                importLine +
                "\n" +
                content.slice(firstImportEnd + 1);
        }
    }

    const providerCall = provider.configSnippet({ envPrefix });

    if (content.includes("providers: []")) {
        content = content.replace(
            "providers: []",
            `providers: [\n    ${providerCall},\n  ]`,
        );
    } else if (!content.includes(provider.id)) {
        const providersMatch = content.match(/providers:\s*\[([\s\S]*?)\]/);
        if (providersMatch) {
            const existing = providersMatch[1].trim();
            content = content.replace(
                /providers:\s*\[[\s\S]*?\]/,
                `providers: [\n    ${existing ? existing + ",\n    " : ""}${providerCall},\n  ]`,
            );
        }
    }

    return content;
}

function providerImportLine(providerId: string): string {
    switch (providerId) {
        case "stripe":
            return `import { stripe } from "@kulupay/kulupay/providers/stripe";`;
        case "chapa":
            return `import { chapa } from "@kulupay/kulupay/providers/chapa";`;
        case "paypal":
            return `import { paypal } from "@kulupay/kulupay/providers/paypal";`;
        default:
            return "";
    }
}

export const addProvider = new Command("add-provider")
    .description("Add a payment provider to your KuluPay project (like shadcn add)")
    .argument("[provider]", "provider id: stripe, chapa, or paypal")
    .option("-c, --cwd <cwd>", "the working directory", process.cwd())
    .option("--force", "reconfigure an existing provider", false)
    .action((provider: string | undefined, opts: any) => {
        return addProviderAction({ ...opts, provider });
    });
