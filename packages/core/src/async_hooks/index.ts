import { AsyncLocalStorage } from "node:async_hooks";
import { KuluPayContext } from "../types";

/**
 * Global store for KuluPay context using AsyncLocalStorage.
 * This allows internal functions to access the context without explicit passing.
 */
export const kuluPayContextStore = new AsyncLocalStorage<KuluPayContext>();

/**
 * Helper to get the current KuluPay context from the store.
 * Throws an error if called outside of a KuluPay execution context.
 */
export const getKuluPayContext = (): KuluPayContext => {
    const context = kuluPayContextStore.getStore();
    if (!context) {
        throw new Error(
            "[KuluPay] Context not found. This function must be called within a KuluPay execution scope (e.g., inside a handler or plugin hook)."
        );
    }
    return context;
};
