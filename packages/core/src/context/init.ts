import { KuluPayOptions, KuluPayContext } from "../types";
import { createKuluPayContext } from "./create-context";

export const init = async (options: KuluPayOptions): Promise<KuluPayContext> => {
    const ctx = await createKuluPayContext(options);
    
    // Initialize providers that have an init function
    // (plugins are initialized in createKuluPayContext)
    for (const provider of ctx.providers.values()) {
        if ('init' in provider && typeof (provider as any).init === 'function') {
            await (provider as any).init(ctx);
        }
    }
    
    return ctx;
};
