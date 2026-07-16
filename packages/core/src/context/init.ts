import { KuluPayOptions, KuluPayContext } from "../types";
import { createKuluPayContext } from "./create-context";

export const init = async (options: KuluPayOptions): Promise<KuluPayContext> => {
    const ctx = await createKuluPayContext(options);
    
    // Initialize plugins
    for (const plugin of ctx.providers.values()) {
        if ('init' in plugin && typeof plugin.init === 'function') {
            await plugin.init(ctx);
        }
    }
    
    return ctx;
};
