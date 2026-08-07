import { atom, type WritableAtom } from "nanostores";
import type { PaymentIntent, ProviderChainConfig } from "@kulupay/core";
import { ONCHAIN_ERROR_CODES, OnchainError, type OnchainErrorCode } from "./error-codes";
import { createKuluPayAppKit, type KuluPayAppKitInstance } from "./appkit/create";

export type { OnchainErrorCode, OnchainErrorContext, NetworkInfo } from "./error-codes";
export { ONCHAIN_ERROR_CODES, OnchainError } from "./error-codes";
export type { KuluPayAppKitInstance, CreateKuluPayAppKitOptions } from "./appkit/create";
export { createKuluPayAppKit } from "./appkit/create";
export { transformChainsToAppKitNetworks, extractTokenConfigs } from "./appkit/config";

/**
 * Minimal plugin interface — matches PayClientPlugin from @kulupay/kulupay/client.
 * Defined locally to avoid circular dependency.
 */
export interface PayClientPlugin {
    id: string;
    getActions?: (fetcher: any, options: any) => Record<string, any>;
    getAtoms?: (fetcher: any) => Record<string, WritableAtom<any>>;
    $ERROR_CODES?: Record<string, { code: string; message: string }>;
}

export interface OnchainClientOptions {
    /**
     * Reown WalletConnect project ID.
     * Public — like a Stripe publishable key. Get one at https://dashboard.reown.com.
     */
    walletConnectProjectId: string;
    /**
     * Chain configs from the server (pay.$context.providers).
     * If not provided, will be fetched from the /config endpoint.
     */
    chains?: ProviderChainConfig[];
    /**
     * App metadata for WalletConnect
     */
    metadata?: {
        name: string;
        description: string;
        url: string;
        icons: string[];
    };
    /**
     * Reown AppKit theme options
     */
    themeOptions?: {
        themeMode?: "dark" | "light" | "auto";
        themeVariables?: Record<string, string>;
        customWallets?: any[];
        enableWallets?: any[];
        featuredWallets?: string[];
    };
}

export interface OnchainActions {
    connectWallet: () => Promise<void>;
    disconnect: () => void;
    isConnected: () => boolean;
    getAddress: () => string | null;
    getChainId: () => number | string | undefined;
    getBalance: (address?: string) => Promise<{ formatted: string; symbol: string; value: bigint } | null>;
    sendPayment: (intent: PaymentIntent) => Promise<{ txHash: string; status: "confirmed" | "pending" }>;
}

/**
 * Onchain client plugin for KuluPay.
 *
 * Provides wallet actions (connect, sendPayment, getBalance) under the `onchain` namespace.
 * Uses AppKit internally for wallet connection and signing.
 *
 * @example
 * ```ts
 * const payClient = createPayClient({
 *   baseURL: "...",
 *   plugins: [
 *     onchainClient({
 *       walletConnectProjectId: "YOUR_PROJECT_ID",
 *       chains: [...], // optional, fetched from /config if not provided
 *     }),
 *   ],
 * });
 *
 * // Core payment actions
 * await payClient.createPayment({ provider: "ethereum", amount: 10, currency: "USD", token: "USDC" });
 *
 * // Onchain wallet actions
 * await payClient.onchain.connectWallet();
 * await payClient.onchain.sendPayment(intent);
 * ```
 */
export const onchainClient = (options: OnchainClientOptions): PayClientPlugin => {
    let appKitInstance: KuluPayAppKitInstance | null = null;

    // Atoms for reactive state
    const $connected = atom<boolean>(false);
    const $address = atom<string | null>(null);
    const $chainId = atom<number | string | undefined>(undefined);
    const $balance = atom<{ formatted: string; symbol: string; value: bigint } | null>(null);
    const $isConnecting = atom<boolean>(false);
    const $isSending = atom<boolean>(false);

    function getAppKit(chains?: ProviderChainConfig[]): KuluPayAppKitInstance {
        if (appKitInstance) return appKitInstance;

        const resolvedChains = chains ?? options.chains ?? [];
        if (resolvedChains.length === 0) {
            throw new OnchainError("WALLET_NOT_FOUND", {
                details: "No onchain chains configured. Pass chains to onchainClient() or ensure server has onchain providers.",
            });
        }

        appKitInstance = createKuluPayAppKit({
            projectId: options.walletConnectProjectId,
            chains: resolvedChains,
            metadata: options.metadata,
            themeOptions: options.themeOptions,
        });

        const instance = appKitInstance;

        // Subscribe to provider changes
        instance.subscribeProvider((state: any) => {
            $connected.set(instance.isConnected());
            $address.set(instance.getAddress());
            $chainId.set(instance.getChainId());
        });

        return instance;
    }

    function getOnchainActions(fetcher: any): OnchainActions {
        return {
            connectWallet: async () => {
                $isConnecting.set(true);
                try {
                    const appKit = getAppKit();
                    appKit.open();
                    // Wait for connection — the modal handles the flow
                    // User may reject, which is handled by the modal UI
                } finally {
                    $isConnecting.set(false);
                }
            },

            disconnect: () => {
                const appKit = getAppKit();
                appKit.disconnect();
                $connected.set(false);
                $address.set(null);
                $balance.set(null);
            },

            isConnected: () => {
                if (!appKitInstance) return false;
                return appKitInstance.isConnected();
            },

            getAddress: () => {
                if (!appKitInstance) return null;
                return appKitInstance.getAddress();
            },

            getChainId: () => {
                if (!appKitInstance) return undefined;
                return appKitInstance.getChainId();
            },

            getBalance: async (address?: string) => {
                if (!appKitInstance) return null;
                const balance = await appKitInstance.getBalance(address);
                $balance.set(balance);
                return balance;
            },

            sendPayment: async (intent: PaymentIntent) => {
                $isSending.set(true);
                try {
                    const appKit = getAppKit();

                    if (!appKit.isConnected()) {
                        appKit.open();
                        throw new OnchainError("WALLET_NOT_CONNECTED", {
                            details: "Wallet not connected. Opening AppKit modal...",
                        });
                    }

                    const raw = (intent as any).raw;
                    if (!raw) {
                        throw new OnchainError("MISSING_PAYMENT_DATA");
                    }

                    const family = intent.metadata?.family;
                    let txHash: string;

                    if (family === "tron") {
                        const provider = appKit.modal.getWalletProvider();
                        if (!provider) {
                            throw new OnchainError("WALLET_NOT_CONNECTED");
                        }
                        const result = await (provider as any).request({
                            method: "tron_sendTransaction",
                            params: [raw],
                        });
                        txHash = typeof result === "string" ? result : result?.txid ?? result?.hash ?? "";
                    } else {
                        // EVM: check chain and switch if needed
                        const currentChainId = appKit.getChainId();
                        const targetChainId = raw.chainId ?? intent.metadata?.chainId;

                        if (targetChainId && Number(currentChainId) !== Number(targetChainId)) {
                            try {
                                await appKit.switchChain(Number(targetChainId));
                            } catch (switchErr: any) {
                                throw OnchainError.fromWalletError(switchErr);
                            }
                        }

                        txHash = await appKit.sendEVMTx({
                            to: raw.to,
                            value: raw.value ? BigInt(raw.value) : BigInt(0),
                            data: raw.data,
                        });
                    }

                    // Confirm with server
                    try {
                        await fetcher("/confirm-intent", {
                            method: "POST",
                            body: {
                                intentId: intent.id,
                                txHash,
                                clientSecret: intent.clientSecret || intent.id,
                            },
                        });
                    } catch {
                        // Confirmation failure doesn't block — tx is on-chain
                    }

                    return { txHash, status: "confirmed" as const };
                } catch (err: any) {
                    if (err instanceof OnchainError) throw err;
                    throw OnchainError.fromWalletError(err);
                } finally {
                    $isSending.set(false);
                }
            },
        };
    }

    return {
        id: "onchain",

        getActions(fetcher: any, _opts: any) {
            return {
                onchain: getOnchainActions(fetcher),
            };
        },

        getAtoms(_fetcher: any) {
            return {
                $onchainConnected: $connected,
                $onchainAddress: $address,
                $onchainChainId: $chainId,
                $onchainBalance: $balance,
                $onchainIsConnecting: $isConnecting,
                $onchainIsSending: $isSending,
            } as Record<string, WritableAtom<any>>;
        },

        $ERROR_CODES: ONCHAIN_ERROR_CODES as unknown as Record<string, { code: string; message: string }>,
    };
};
