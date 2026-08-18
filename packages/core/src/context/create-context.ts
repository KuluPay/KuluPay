import { KuluPayContext, KuluPayOptions, PaymentProvider, KuluPayORM, KuluPayPlugin } from "../types";
import { createOrm } from "@farming-labs/orm";
import { getKuluPayTables } from "../db/get-tables";
import { resolveDatabaseDriver } from "../db/resolve-database";
import { onchain } from "../payment-providers/onchain/config";

/**
 * Run plugin init functions, merging any returned context/options modifications.
 * Mirrors better-auth's runPluginInit pattern.
 */
async function runPluginInit(context: KuluPayContext): Promise<void> {
    const plugins = context.options.plugins || [];
    for (const plugin of plugins) {
        if (!plugin.init) continue;
        const result = await plugin.init(context);
        if (typeof result === "object" && result !== null) {
            if (result.options) {
                context.options = { ...context.options, ...result.options };
            }
            if (result.context) {
                Object.assign(context, result.context);
            }
        }
    }
}

export const createKuluPayContext = async (
    options: KuluPayOptions
): Promise<KuluPayContext> => {
    const providers = new Map<string, PaymentProvider>();
    if (options.providers) {
        const isProviderArray = Array.isArray(options.providers) ||
            (typeof options.providers === "object" &&
                options.providers !== null &&
                typeof (options.providers as any).length === "number" &&
                !(options.providers as any).ethereum);

        const resolvedProviders: PaymentProvider[] = isProviderArray
            ? (options.providers as PaymentProvider[])
            : onchain(options.providers as any);
        for (const provider of resolvedProviders) {
            providers.set(provider.id, provider);
        }
    }

    const baseURL = typeof options.baseURL === "string" ? options.baseURL : "http://localhost:3000";

    const logger = {
        debug: (message: string, ...args: any[]) => {
            if (options.debug) {
                console.log(`[KuluPay:DEBUG] ${message}`, ...args);
            }
        },
        error: (message: string, ...args: any[]) => {
            console.error(`[KuluPay:ERROR] ${message}`, ...args);
        },
        warn: (message: string, ...args: any[]) => {
            console.warn(`[KuluPay:WARN] ${message}`, ...args);
        },
    };

    const schema = getKuluPayTables(options);
    const driver = await resolveDatabaseDriver(options.database);
    const orm = createOrm({
        schema,
        driver,
    }) as KuluPayORM;

    const plugins = options.plugins || [];
    const pluginIds = new Set(plugins.map((p) => p.id));

    const getPlugin = (id: string): KuluPayPlugin | null =>
        plugins.find((p) => p.id === id) ?? null;

    const hasPlugin = (id: string): boolean => pluginIds.has(id);

    const context: KuluPayContext = {
        options,
        providers,
        plugins,
        orm,
        baseURL,
        trustedOrigins: [],
        logger,
        getPlugin,
        hasPlugin,
    };

    // Initialize plugins — can modify context/options
    await runPluginInit(context);

    return context;
};

