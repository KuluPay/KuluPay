import { atom, type WritableAtom } from "nanostores";
import type { PaymentIntent, ProviderChainConfig } from "@kulupay/core";
import { ONCHAIN_ERROR_CODES, OnchainError, type OnchainErrorCode } from "./error-codes";
import { createKuluPayAppKit, type KuluPayAppKitInstance } from "./appkit/create";

export type { OnchainErrorCode, OnchainErrorContext, NetworkInfo } from "./error-codes";
export { ONCHAIN_ERROR_CODES, OnchainError } from "./error-codes";
export type { KuluPayAppKitInstance, CreateKuluPayAppKitOptions } from "./appkit/create";
export { createKuluPayAppKit } from "./appkit/create";
export { transformChainsToAppKitNetworks, extractTokenConfigs } from "./appkit/config";

async function getTronWebClass(): Promise<any> {
    const mod: any = await import("tronweb");
    return mod.TronWeb ?? mod.default?.TronWeb ?? mod.default;
}

/** 100 TRX — used when the chain config does not specify a fee limit. */
const DEFAULT_TRON_FEE_LIMIT = 100_000_000;

const UNSUPPORTED_METHOD = /unsupported method|not supported|unknown method|method not found/i;

/**
 * Amounts from the server are always in base units (integer strings).
 * A decimal string means the server config is wrong — fail loudly instead of
 * letting `BigInt()` throw an unhandled TypeError.
 */
function toBaseUnits(amount: unknown): bigint {
    if (typeof amount === "bigint") return amount;
    const value = String(amount ?? "").trim();
    if (!/^\d+$/.test(value)) {
        throw new OnchainError("MISSING_PAYMENT_DATA", {
            details: `Expected amount in base units (integer string), received "${String(amount)}"`,
        });
    }
    return BigInt(value);
}

function requireTxHash(...candidates: unknown[]): string {
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.length > 0) return candidate;
    }
    throw new OnchainError("TRANSACTION_FAILED", {
        details: "Wallet/RPC did not return a transaction hash",
    });
}

/** Tron chain ids are the last 4 bytes of the genesis block hash, e.g. 0xcd8690dc for Nile. */
function toTronChainIdHex(chainId: number | string): string {
    const asString = String(chainId);
    if (asString.startsWith("0x")) return asString.toLowerCase();
    return `0x${Number(asString).toString(16)}`;
}

/**
 * Tron wallets pick their own network and reject transactions built for another
 * one ("Network mismatched between the DApp and your wallet"). Detect that up
 * front, try to switch the wallet, and otherwise fail with a clear error.
 */
async function ensureTronNetwork(provider: any, chainConfig: any): Promise<void> {
    if (chainConfig?.chainId == null) return;

    // AppKit's injected connector wraps a tronwallet adapter; WalletConnect
    // connectors expose no network introspection, so we skip the check there.
    const adapter = provider?.adapter ?? provider;
    if (typeof adapter?.network !== "function") return;

    const expected = toTronChainIdHex(chainConfig.chainId);

    const currentChainId = async (): Promise<string> => {
        try {
            const network = await adapter.network();
            return String(network?.chainId ?? "").toLowerCase();
        } catch {
            return "";
        }
    };

    let current = await currentChainId();
    if (!current || current === expected) return;

    if (typeof adapter.switchChain === "function") {
        try {
            await adapter.switchChain(expected);
            current = await currentChainId();
            if (!current || current === expected) return;
        } catch {
            // Wallet refused or does not implement wallet_switchChain
        }
    }

    throw new OnchainError("WRONG_CHAIN", {
        expectedChain: chainConfig.name ?? expected,
        actualChain: current,
        details: `Wallet is on Tron chain ${current}, this payment requires ${expected} (${chainConfig.name ?? "unknown"}). Switch networks in your wallet and try again.`,
    });
}

/**
 * Sign a Tron transaction with whatever the connected wallet supports.
 *
 * Wallet providers disagree on the signing entrypoint: the tronwallet adapters
 * expose `signTransaction`, TronLink exposes `tronWeb.trx.sign`, AppKit's
 * WalletConnect connector proxies `tron_signTransaction`, and AppKit's injected
 * connector only accepts `tron_sendTransaction` (which signs, despite the name).
 * We try each in turn, but only fall through on "unsupported method" errors so a
 * user rejection still surfaces immediately.
 */
async function signTronTx(provider: any, unsignedTx: any, fromAddress: string): Promise<any> {
    const attempts: Array<() => Promise<any>> = [];

    if (typeof provider?.signTransaction === "function") {
        attempts.push(() => provider.signTransaction(unsignedTx));
    }
    if (typeof provider?.tronWeb?.trx?.sign === "function") {
        attempts.push(() => provider.tronWeb.trx.sign(unsignedTx));
    }
    if (typeof provider?.request === "function") {
        attempts.push(() => provider.request({
            method: "tron_signTransaction",
            params: { address: fromAddress, transaction: unsignedTx },
        }));
        attempts.push(() => provider.request({
            method: "tron_sendTransaction",
            params: { transaction: unsignedTx },
        }));
    }

    if (attempts.length === 0) {
        throw new OnchainError("WALLET_NOT_FOUND", {
            details: "Connected Tron wallet exposes no transaction signing method",
        });
    }

    let lastError: unknown;
    for (const attempt of attempts) {
        try {
            const signedTx = await attempt();
            if (signedTx?.signature) return signedTx;
            lastError = new Error("Wallet returned a transaction without a signature");
        } catch (err: any) {
            if (!UNSUPPORTED_METHOD.test(String(err?.message ?? err))) throw err;
            lastError = err;
        }
    }

    throw new OnchainError("TRANSACTION_FAILED", {
        details: (lastError as any)?.message || "Failed to sign Tron transaction",
    });
}

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
    /**
     * Log wallet/transaction diagnostics to the console.
     *
     * Off by default — these logs contain raw transaction payloads and wallet
     * addresses, so never enable them in production.
     */
    debug?: boolean;
}

export interface OnchainActions {
    /**
     * Open the wallet modal and resolve once a wallet is connected.
     * Rejects with `USER_REJECTED` if the modal is closed without connecting.
     */
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

    const debugLog = options.debug
        ? (...args: unknown[]) => console.log("[KuluPay:onchain]", ...args)
        : () => { };

    // Atoms for reactive state
    const $connected = atom<boolean>(false);
    const $address = atom<string | null>(null);
    const $chainId = atom<number | string | undefined>(undefined);
    const $balance = atom<{ formatted: string; symbol: string; value: bigint } | null>(null);
    const $isConnecting = atom<boolean>(false);
    const $isSending = atom<boolean>(false);

    /**
     * Single injection point for the AppKit instance. Idempotent — re-attaching
     * the same instance won't double-subscribe and fire duplicate atom updates.
     */
    function attachAppKit(instance: KuluPayAppKitInstance): KuluPayAppKitInstance {
        if (appKitInstance === instance) return instance;
        appKitInstance = instance;
        instance.subscribeProvider(() => {
            $connected.set(instance.isConnected());
            $address.set(instance.getAddress());
            $chainId.set(instance.getChainId());
        });
        return instance;
    }

    // Legacy escape hatch — KuluPayAppKitProvider assigns `_shared.instance`.
    // Routed through attachAppKit so there is only one subscription path.
    const shared = {
        get instance() {
            return appKitInstance;
        },
        set instance(instance: KuluPayAppKitInstance | null) {
            if (instance) attachAppKit(instance);
        },
    };

    function getAppKit(chains?: ProviderChainConfig[]): KuluPayAppKitInstance {
        if (appKitInstance) return appKitInstance;

        const resolvedChains = chains ?? options.chains ?? [];
        if (resolvedChains.length === 0) {
            throw new OnchainError("WALLET_NOT_FOUND", {
                details: "No onchain chains configured. Pass chains to onchainClient() or ensure server has onchain providers.",
            });
        }

        return attachAppKit(createKuluPayAppKit({
            projectId: options.walletConnectProjectId,
            chains: resolvedChains,
            metadata: options.metadata,
            themeOptions: options.themeOptions,
        }));
    }

    /**
     * Resolve once the wallet reports connected, reject if the user closes the
     * modal first. AppKit exposes no connect promise, so we poll modal state.
     */
    function waitForConnection(appKit: KuluPayAppKitInstance, timeoutMs = 5 * 60 * 1000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const startedAt = Date.now();
            let modalWasOpen = false;

            const poll = setInterval(() => {
                if (appKit.isConnected()) {
                    clearInterval(poll);
                    resolve();
                    return;
                }

                const isOpen = Boolean((appKit.modal as any).getState?.().open);
                if (isOpen) modalWasOpen = true;

                if (modalWasOpen && !isOpen) {
                    clearInterval(poll);
                    reject(new OnchainError("USER_REJECTED", {
                        details: "Wallet modal was closed before a wallet connected",
                    }));
                    return;
                }

                if (Date.now() - startedAt > timeoutMs) {
                    clearInterval(poll);
                    reject(new OnchainError("WALLET_NOT_CONNECTED", {
                        details: "Timed out waiting for the wallet to connect",
                    }));
                }
            }, 250);
        });
    }

    function getOnchainActions(fetcher: any): OnchainActions {
        return {
            setAppKit: (instance: KuluPayAppKitInstance) => {
                attachAppKit(instance);
            },

            getProjectId: () => options.walletConnectProjectId,

            connectWallet: async () => {
                $isConnecting.set(true);
                try {
                    const appKit = getAppKit();
                    if (appKit.isConnected()) return;
                    appKit.open();
                    await waitForConnection(appKit);
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
                    debugLog("sendPayment start", { family, rawKeys: Object.keys(raw) });
                    let txHash: string;

                    if (family === "tron") {
                        const provider = appKit.modal.getWalletProvider() as any;
                        const fromAddress = appKit.getAddress();
                        const chainConfig = (intent as any).chainConfig ?? appKit.chains.find((c: any) => c.family === "tron");
                        const rpcUrl = chainConfig?.rpcUrl;
                        const amount = toBaseUnits(raw.amount);

                        debugLog("sendPayment tron", {
                            rpcUrl,
                            chain: chainConfig?.name,
                            providerType: provider?.constructor?.name || typeof provider,
                        });

                        if (!fromAddress) {
                            throw new OnchainError("WALLET_NOT_CONNECTED");
                        }

                        await ensureTronNetwork(provider, chainConfig);

                        if (raw.contractAddress) {
                            if (!rpcUrl) {
                                throw new OnchainError("MISSING_PAYMENT_DATA", { details: "Tron RPC URL not configured" });
                            }
                            const TronWeb = await getTronWebClass();
                            const tw = new TronWeb({ fullHost: rpcUrl });
                            const triggerResult = await tw.transactionBuilder.triggerSmartContract(
                                raw.contractAddress,
                                "transfer(address,uint256)",
                                {
                                    feeLimit: Number(chainConfig?.feeLimit ?? DEFAULT_TRON_FEE_LIMIT),
                                    callValue: 0,
                                },
                                [
                                    { type: "address", value: raw.to },
                                    { type: "uint256", value: amount },
                                ],
                                fromAddress,
                            );
                            const unsignedTx = triggerResult?.transaction;
                            if (!unsignedTx?.txID) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: triggerResult?.result?.message || "Failed to build TRC-20 transaction" });
                            }

                            const signedTx = await signTronTx(provider, unsignedTx, fromAddress);
                            const broadcast = await tw.trx.sendRawTransaction(signedTx);
                            debugLog("TRC-20 broadcast", { result: broadcast?.result });
                            if (!broadcast?.result) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: broadcast?.message || "Failed to broadcast TRC-20 transaction" });
                            }
                            txHash = requireTxHash(signedTx?.txID, broadcast?.txid, broadcast?.transaction?.txID);
                        } else if (typeof provider?.sendTransaction === "function") {
                            txHash = requireTxHash(await provider.sendTransaction({
                                from: fromAddress,
                                to: raw.to,
                                value: amount.toString(),
                            }));
                        } else {
                            if (!rpcUrl) {
                                throw new OnchainError("MISSING_PAYMENT_DATA", { details: "Tron RPC URL not configured" });
                            }
                            const TronWeb = await getTronWebClass();
                            const tw = new TronWeb({ fullHost: rpcUrl });
                            const unsignedTx = await tw.transactionBuilder.sendTrx(raw.to, Number(amount), fromAddress);
                            if (!unsignedTx?.txID) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: "Failed to build TRX transaction" });
                            }

                            const signedTx = await signTronTx(provider, unsignedTx, fromAddress);
                            const broadcast = await tw.trx.sendRawTransaction(signedTx);
                            debugLog("TRX broadcast", { result: broadcast?.result });
                            if (!broadcast?.result) {
                                throw new OnchainError("TRANSACTION_FAILED", { details: broadcast?.message || "Failed to broadcast TRX transaction" });
                            }
                            txHash = requireTxHash(signedTx?.txID, broadcast?.txid, broadcast?.transaction?.txID);
                        }
                    } else {
                        const currentChainId = appKit.getChainId();
                        const targetChainId = raw.chainId ?? intent.metadata?.chainId;

                        if (targetChainId && Number(currentChainId) !== Number(targetChainId)) {
                            await appKit.switchChain(Number(targetChainId));
                        }

                        txHash = requireTxHash(await appKit.sendEVMTx({
                            to: raw.to,
                            value: raw.value ? toBaseUnits(raw.value) : BigInt(0),
                            data: raw.data,
                        }));
                    }

                    // Confirm with server. A failure here doesn't block — the tx is
                    // already on-chain — but it must be logged so an unconfirmed
                    // payment can be reconciled against the txHash.
                    try {
                        const cs = intent.clientSecret;
                        if (!cs) {
                            throw new Error("Missing clientSecret on intent — cannot confirm");
                        }
                        await fetcher("/confirm-intent", {
                            method: "POST",
                            body: {
                                intentId: intent.id,
                                txHash,
                                clientSecret: cs,
                            },
                        });
                    } catch (err: any) {
                        console.warn(
                            `[KuluPay] Payment ${intent.id} was broadcast (tx ${txHash}) but /confirm-intent failed — reconcile manually:`,
                            err?.message ?? err,
                        );
                    }

                    return { txHash, status: "confirmed" as const };
                } catch (err: any) {
                    debugLog("sendPayment error", err);
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
