import { KuluPayContext, KuluPayOptions, PaymentProvider, KuluPayORM } from "../types";
import { createOrm } from "@farming-labs/orm";
import { getKuluPayTables } from "../db/get-tables";
import { resolveDatabaseDriver } from "../db/resolve-database";
import { blockchain } from "../payment-providers/blockchain/config";

export const createKuluPayContext = async (
    options: KuluPayOptions
): Promise<KuluPayContext> => {
    const providers = new Map<string, PaymentProvider>();
    if (options.providers) {
        const resolvedProviders = blockchain(options.providers);
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
    };

    const schema = getKuluPayTables(options);
    const driver = await resolveDatabaseDriver(options.database);
    const orm = createOrm({
        schema,
        driver,
    }) as KuluPayORM;

    const plugins = options.plugins || [];
    return {
        options,
        providers,
        plugins,
        orm,
        baseURL,
        trustedOrigins: [], // Will be populated in the handler or via init
        logger,
    };
};

