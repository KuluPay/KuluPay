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
import { createEVMClientProvider } from "./providers/evm";
import { createTronClientProvider } from "./providers/tron";

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

function getProviderForId(providerId: string) {
    if (providerId.startsWith("tron")) {
        const tw = (globalThis as any).tronWeb;
        if (!tw) return null;
        return createTronClientProvider({
            id: providerId,
            recipientAddress: "",
            network: {
                name: "Tron Nile",
                chainId: 3448148188,
                rpcUrl: "https://nile.trongrid.io",
                explorerUrl: "https://nile.tronscan.org",
                isTestnet: true,
                faucetUrl: "https://nileex.io/join/getJoinPage",
            },
        });
    }
    const eth = (globalThis as any).ethereum;
    if (!eth) return null;

    if (providerId.includes("base")) {
        return createEVMClientProvider({
            chainId: 84532,
            id: providerId,
            recipientAddress: "0x0" as `0x${string}`,
            network: {
                name: "Base Sepolia",
                chainId: 84532,
                rpcUrl: "https://sepolia.base.org",
                explorerUrl: "https://sepolia.basescan.org",
                isTestnet: true,
                faucetUrl: "https://www.coinbase.com/faucet/base-sepolia",
            },
        });
    }

    return createEVMClientProvider({
        chainId: 11155111,
        id: providerId,
        recipientAddress: "0x0" as `0x${string}`,
        network: {
            name: "Ethereum Sepolia",
            chainId: 11155111,
            rpcUrl: "https://rpc.sepolia.org",
            explorerUrl: "https://sepolia.etherscan.io",
            isTestnet: true,
            faucetUrl: "https://sepoliafaucet.com",
        },
    });
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

export function createPayClient(options: PayClientOptions) {
    const client = createVanillaPayClient(options);
    const usePay = createUsePay(client);

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

        const provider = getProviderForId(providerId);
        if (!provider) {
            return { data: null, error: new KuluPayClientError("NO_PROVIDER", `No wallet found for "${providerId}".`, 400) };
        }

        client.$intent.set({ data: current, error: null, isPending: true });
        try {
            const result = await provider.confirmPayment(secret, {
                ...opts,
                paymentMethodData: current.raw,
                intentId: current.id,
            });

            const txHash = result.metadata?.txHash;
            if (txHash) {
                try {
                    const confirmResult = await client.confirmIntent({
                        body: { intentId: current.id, txHash, clientSecret: secret },
                    });
                    if (confirmResult?.data) {
                        client.$intent.set({ data: { ...current, ...result, ...confirmResult.data, id: current.id }, error: null, isPending: false });
                    } else {
                        client.$intent.set({ data: { ...current, ...result, id: current.id }, error: null, isPending: false });
                    }
                } catch (confirmErr) {
                    client.$intent.set({ data: { ...current, ...result, id: current.id }, error: null, isPending: false });
                }
            } else {
                client.$intent.set({ data: { ...current, ...result, id: current.id }, error: null, isPending: false });
            }
            return { data: { ...result, id: current.id }, error: null };
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
    });
}

export type PayClient = ReturnType<typeof createPayClient>;





