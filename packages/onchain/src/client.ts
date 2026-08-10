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
    /**s
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
    /** Inject an externally-created AppKit instance (e.g. from KuluPayAppKitProvider) */
    setAppKit: (instance: KuluPayAppKitInstance) => void;
    /** Get the WalletConnect project ID from plugin options */
    getProjectId: () => string;
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

    // Shared container — the provider can set the AppKit instance here
    // directly on the plugin object, bypassing the proxy
    const shared = { instance: null as KuluPayAppKitInstance | null };

    // Atoms for reactive state
    const $connected = atom<boolean>(false);
    const $address = atom<string | null>(null);
    const $chainId = atom<number | string | undefined>(undefined);
    const $balance = atom<{ formatted: string; symbol: string; value: bigint } | null>(null);
    const $isConnecting = atom<boolean>(false);
    const $isSending = atom<boolean>(false);

    function getAppKit(chains?: ProviderChainConfig[]): KuluPayAppKitInstance {
        const injected = appKitInstance ?? shared.instance;
        if (injected) return injected;

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
            setAppKit: (instance: KuluPayAppKitInstance) => {
                appKitInstance = instance;
                instance.subscribeProvider((state: any) => {
                    $connected.set(instance.isConnected());
                    $address.set(instance.getAddress());
                    $chainId.set(instance.getChainId());
                });
            },

            getProjectId: () => options.walletConnectProjectId,

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
                    const raw = (intent as any).raw;
                    if (!raw) {
                        throw new OnchainError("MISSING_PAYMENT_DATA");
                    }

                    const family = intent.metadata?.family;
                    console.log("[KuluPay:DEBUG] sendPayment start", { family, metadata: intent.metadata, hasRaw: !!intent.raw, rawKeys: intent.raw ? Object.keys(intent.raw) : [] });
                    let txHash: string;

                    if (family === "tron") {
                        const provider = appKit.modal.getWalletProvider() as any;
                        const fromAddress = appKit.getAddress();
                        const chainConfig = (intent as any).chainConfig ?? appKit.chains.find((c: any) => c.family === "tron");
                        const rpcUrl = chainConfig?.rpcUrl;

                        console.log("[KuluPay:DEBUG] sendPayment tron", { raw, fromAddress, hasSendTransaction: typeof provider?.sendTransaction, rpcUrl, providerType: provider?.constructor?.name || typeof provider });

                        if (!fromAddress) {
                            throw new OnchainError("WALLET_NOT_CONNECTED");
                        }

                        if (raw.contractAddress) {
                            if (!rpcUrl) {
                                throw new OnchainError("MISSING_PAYMENT_DATA", { details: "Tron RPC URL not configured" });
                            }

                            const TronWeb = (await import("tronweb")).default as any;
                            const tw = new TronWeb({ fullHost: rpcUrl });
                            const parameter = [
                                { type: "address", value: raw.to },
                                { type: "uint256", value: BigInt(raw.amount) },
                            ];
                            const triggerResult = await tw.transactionBuilder.triggerSmartContract(
                                raw.contractAddress,
                                "transfer(address,uint256)",
                                { feeLimit: 100000000, callValue: 0 },
                                parameter,
                                fromAddress,
                            );
                            const unsignedTx = triggerResult?.transaction;
                            if (!unsignedTx?.txID) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: triggerResult?.result?.message || "Failed to build TRC-20 transaction" });
                            }

                            const signedTx = await (provider as any).request({
                                method: "tron_sendTransaction",
                                params: { transaction: unsignedTx },
                            });
                            console.log("[KuluPay:DEBUG] TRC-20 signed", signedTx);

                            const broadcast = await tw.trx.sendRawTransaction(signedTx);
                            console.log("[KuluPay:DEBUG] TRC-20 broadcast", broadcast);
                            if (!broadcast?.result) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: broadcast?.message || "Failed to broadcast TRC-20 transaction" });
                            }
                            txHash = signedTx?.txID ?? broadcast?.txid ?? broadcast?.transaction?.txID ?? "";
                        } else {
                            if (typeof provider.sendTransaction === "function") {
                                console.log("[KuluPay:DEBUG] Sending TRX via provider.sendTransaction");
                                txHash = await provider.sendTransaction({
                                    from: fromAddress,
                                    to: raw.to,
                                    value: String(raw.amount),
                                });
                                console.log("[KuluPay:DEBUG] TRX result", txHash);
                            } else {
                                if (!rpcUrl) {
                                    throw new OnchainError("MISSING_PAYMENT_DATA", { details: "Tron RPC URL not configured" });
                                }
                                const TronWeb = (await import("tronweb")).default as any;
                                const tw = new TronWeb({ fullHost: rpcUrl });
                                const unsignedTx = await tw.transactionBuilder.sendTrx(raw.to, Number(raw.amount), fromAddress);
                                const signedTx = await (provider as any).request({
                                    method: "tron_sendTransaction",
                                    params: { transaction: unsignedTx },
                                });
                                const broadcast = await tw.trx.sendRawTransaction(signedTx);
                                if (!broadcast?.result) {
                                    throw new OnchainError("TRANSACTION_FAILED", { details: broadcast?.message || "Failed to broadcast TRX transaction" });
                                }
                                txHash = signedTx?.txID ?? broadcast?.txid ?? broadcast?.transaction?.txID ?? "";
                            }
                        }
                    } else {
                        const currentChainId = appKit.getChainId();
                        const targetChainId = raw.chainId ?? intent.metadata?.chainId;

                        if (targetChainId && Number(currentChainId) !== Number(targetChainId)) {
                            await appKit.switchChain(Number(targetChainId));
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
                    console.error("[KuluPay:DEBUG] sendPayment raw error", err);
                    if (err instanceof OnchainError) throw err;
                    throw OnchainError.fromWalletError(err);
                } finally {
                    $isSending.set(false);
                }
            },
        };
    }

    const plugin: PayClientPlugin & { walletConnectProjectId?: string; _shared?: typeof shared } = {
        id: "onchain",
        walletConnectProjectId: options.walletConnectProjectId,
        _shared: shared,

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

    return plugin;
};
