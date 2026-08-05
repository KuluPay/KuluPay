import { useCallback, useSyncExternalStore, useRef } from "react";
import type { Store, StoreValue } from "nanostores";
import type {
    CreateIntentData,
    PaymentIntent,
    PaymentConfirmOptions,
} from "@kulupay/core";
import {
    createPayClient as createVanillaPayClient,
    type PayClientOptions,
    type PayClient as VanillaPayClient,
    type PayClientPlugin,
} from "./vanilla";
import { KuluPayClientError } from "./error";
import type { KuluPayAppKitInstance } from "./appkit";

export type { PayClientOptions, PayClientPlugin };

function useStore<SomeStore extends Store>(
    store: SomeStore,
): StoreValue<SomeStore> {
    const snapshotRef = useRef<StoreValue<SomeStore>>(store.get());

    const subscribe = useCallback((onChange: () => void) => {
        const emitChange = (value: StoreValue<SomeStore>) => {
            if (snapshotRef.current === value) return;
            snapshotRef.current = value;
            onChange();
        };
        emitChange(store.value);
        return store.listen(emitChange);
    }, [store]);

    const get = () => snapshotRef.current as StoreValue<SomeStore>;
    return useSyncExternalStore(subscribe, get, get);
}

export interface UsePayReturn {
    data: PaymentIntent | null;
    isPending: boolean;
    error: KuluPayClientError | null;
    refetch: () => Promise<void>;
}

export interface CreatePayClientOptions extends PayClientOptions {
    /**
     * AppKit instance for vanilla JS usage (non-React).
     * React users should use KuluPayAppKitProvider instead —
     * the provider initializes AppKit and passes it via context.
     */
    appKit?: KuluPayAppKitInstance;
}

function createUsePay(client: VanillaPayClient) {
    return function usePay(providerId?: string): UsePayReturn {
        const state = useStore(client.$intent);

        const refetch = useCallback(async () => {
            const current = client.$intent.get().data;
            if (current?.id) {
                client.$intent.set({ data: current, error: null, isPending: true });
                const { data, error } = await client.getIntent({ id: current.id, providerId });
                client.$intent.set({ data, error: error || null, isPending: false });
            }
        }, [providerId]);

        return {
            data: state.data,
            isPending: state.isPending,
            error: state.error,
            refetch,
        };
    };
}

export function createPayClient(options: CreatePayClientOptions) {
    const client = createVanillaPayClient(options);
    const usePay = createUsePay(client);
    const appKit = options.appKit;

    const confirmPayment = async (data: {
        providerId: string;
        intentId?: string;
        options?: PaymentConfirmOptions;
    }): Promise<{ data: PaymentIntent | null; error: KuluPayClientError | null }> => {
        const { providerId, options: opts } = data;

        const current = client.$intent.get().data;

        const secret = current?.clientSecret || current?.id;
        if (!current || !secret) {
            return { data: null, error: new KuluPayClientError("NO_INTENT", "Call createIntent first.", 400) };
        }

        if (!appKit) {
            return {
                data: null,
                error: new KuluPayClientError(
                    "NO_PROVIDER",
                    "AppKit is not initialized. Pass appKit to createPayClient or use KuluPayAppKitProvider.",
                    400,
                ),
            };
        }

        if (!appKit.isConnected()) {
            appKit.open();
            return {
                data: null,
                error: new KuluPayClientError(
                    "NO_PROVIDER",
                    "Wallet not connected. Opening AppKit modal...",
                    400,
                ),
            };
        }

        client.$intent.set({ data: current, error: null, isPending: true });
        try {
            const raw = (current as any).raw;
            if (!raw) {
                throw new KuluPayClientError("CONFIRM_FAILED", "No transaction data in intent.", 400);
            }

            const family = current.metadata?.family;
            let txHash: string;

            if (family === "tron") {
                const provider = appKit.modal.getWalletProvider();
                if (!provider) {
                    throw new KuluPayClientError("NO_PROVIDER", "No wallet provider connected.", 400);
                }
                const result = await (provider as any).request({
                    method: "tron_sendTransaction",
                    params: [raw],
                });
                txHash = typeof result === "string" ? result : result?.txid ?? result?.hash ?? "";
            } else {
                txHash = await appKit.sendEVMTx({
                    to: raw.to,
                    value: raw.value ? BigInt(raw.value) : BigInt(0),
                    data: raw.data,
                });
            }

            if (txHash) {
                try {
                    const confirmResult = await client.confirmIntent({
                        body: { intentId: current.id, txHash, clientSecret: secret },
                    });
                    if (confirmResult?.data) {
                        client.$intent.set({
                            data: { ...current, ...confirmResult.data, id: current.id },
                            error: null,
                            isPending: false,
                        });
                    } else {
                        client.$intent.set({ data: { ...current, id: current.id }, error: null, isPending: false });
                    }
                } catch (confirmErr) {
                    client.$intent.set({ data: { ...current, id: current.id }, error: null, isPending: false });
                }
            } else {
                client.$intent.set({ data: { ...current, id: current.id }, error: null, isPending: false });
            }
            return { data: { ...current, id: current.id }, error: null };
        } catch (err: any) {
            const e = err instanceof KuluPayClientError
                ? err
                : (() => {
                    const wrapped = new KuluPayClientError(err?.code || "CONFIRM_FAILED", err?.message || "Confirmation failed", 400);
                    if (err?.developerMessage) wrapped.developerMessage = err.developerMessage;
                    if (err?.hint) wrapped.hint = err.hint;
                    return wrapped;
                })();
            client.$intent.set({ data: current, error: e, isPending: false });
            return { data: null, error: e };
        }
    };

    const verifyPayment = async (data: {
        providerId: string;
        intentId?: string;
    }): Promise<{ data: PaymentIntent | null; error: KuluPayClientError | null }> => {
        const current = client.$intent.get().data;

        const secret = current?.clientSecret || current?.id;
        const intentId = data.intentId || current?.id;
        if (!secret || !intentId) {
            return { data: null, error: new KuluPayClientError("NO_INTENT", "Call createIntent first.", 400) };
        }

        client.$intent.set({ data: current, error: null, isPending: true });
        try {
            const result = await client.verifyIntent({
                intentId,
                clientSecret: secret,
            });

            if (result?.data) {
                const verified = result.data as PaymentIntent;
                client.$intent.set({ data: { ...current, ...verified, id: current?.id || verified.id }, error: null, isPending: false });
                return { data: { ...verified, id: current?.id || verified.id }, error: null };
            } else {
                client.$intent.set({ data: current, error: null, isPending: false });
                return { data: current, error: null };
            }
        } catch (err: any) {
            const e = err instanceof KuluPayClientError
                ? err
                : (() => {
                    const wrapped = new KuluPayClientError(err?.code || "VERIFY_FAILED", err?.message || "Verification failed", 400);
                    if (err?.developerMessage) wrapped.developerMessage = err.developerMessage;
                    if (err?.hint) wrapped.hint = err.hint;
                    return wrapped;
                })();
            client.$intent.set({ data: current, error: e, isPending: false });
            return { data: null, error: e };
        }
    };

    return Object.assign(client, {
        usePay,
        confirmPayment,
        verifyPayment,
        appKit,
    });
}

export type PayClient = ReturnType<typeof createPayClient>;
