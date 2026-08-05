import { atom, type ReadableAtom } from "nanostores";
import type { CheckoutIntentData, PayClientLike } from "../types";
import { getProviderType } from "../types";

export type CheckoutStep =
    | "loading"
    | "error"
    | "onchain"
    | "pending-confirmation"
    | "succeeded"
    | "failed"
    | "expired"
    | "redirect";

export interface CheckoutState {
    step: CheckoutStep;
    intent: CheckoutIntentData | null;
    txHash: string | null;
    error: string | null;
}

export interface CheckoutController {
    /** Reactive state store. Use `.get()` for the current value, `.subscribe(fn)` for updates. */
    state: ReadableAtom<CheckoutState>;
    /** Load the intent and determine checkout flow. */
    init(): Promise<void>;
    /** For redirect providers: navigate to the provider's hosted page. */
    redirect(): void;
    /** Stop polling and clean up. */
    destroy(): void;
}

export interface CreateCheckoutOptions {
    intentId: string;
    clientSecret: string;
    client: PayClientLike;
    /** Poll interval in ms for verifying on-chain confirmation. Default 5000. */
    pollInterval?: number;
}

export function createCheckout(options: CreateCheckoutOptions): CheckoutController {
    const { intentId, clientSecret, client, pollInterval = 5000 } = options;

    const $state = atom<CheckoutState>({
        step: "loading",
        intent: null,
        txHash: null,
        error: null,
    });

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const patch = (partial: Partial<CheckoutState>) => {
        $state.set({ ...$state.get(), ...partial });
    };

    const startPolling = () => {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
            try {
                const { data, error } = await client.verifyIntent({ intentId, clientSecret });
                if (error || !data) return;

                if (data.status === "succeeded" || data.status === "failed" || data.status === "expired") {
                    const step = data.status === "succeeded" ? "succeeded" : data.status === "expired" ? "expired" : "failed";
                    patch({ step, txHash: data.txHash || $state.get().txHash });
                    stopPolling();
                } else if (data.status === "pending_confirmation") {
                    patch({ step: "pending-confirmation", txHash: data.txHash || $state.get().txHash });
                }
            } catch {
                // retry on next poll
            }
        }, pollInterval);
    };

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    return {
        state: $state,

        async init() {
            try {
                const { data, error } = await client.checkoutIntent({ intentId, clientSecret });
                if (error || !data) throw new Error(error?.message || "Failed to load payment");
                const intent = data as CheckoutIntentData;

                if (intent.status === "succeeded") {
                    patch({ intent, step: "succeeded", txHash: intent.txHash });
                    return;
                }
                if (intent.status === "expired") {
                    patch({ intent, step: "expired" });
                    return;
                }
                if (intent.status === "pending_confirmation") {
                    patch({ intent, step: "pending-confirmation", txHash: intent.txHash });
                    startPolling();
                    return;
                }

                const providerType = getProviderType(intent.providerId, intent.checkoutFlow);
                if (providerType === "redirect") {
                    patch({ intent, step: "redirect" });
                    return;
                }
                if (providerType === "evm" || providerType === "tron") {
                    patch({ intent, step: "onchain" });
                    return;
                }

                patch({ step: "error", error: `Unknown provider: ${intent.providerId}` });
            } catch (err: any) {
                patch({ step: "error", error: err.message || "Failed to load checkout" });
            }
        },

        redirect() {
            const { intent } = $state.get();
            const url = intent?.raw?.redirectUrl || intent?.metadata?.redirectUrl || intent?.raw?.url;
            if (!url) {
                patch({ error: "No redirect URL available. Please contact the merchant." });
                return;
            }
            window.location.href = url;
        },

        destroy() {
            stopPolling();
        },
    };
}
