import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { TronAdapter } from "@reown/appkit-adapter-tron";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { sendTransaction, getBalance, getAccount, disconnect, switchChain } from "@wagmi/core";
import type { Config as WagmiConfig } from "wagmi";
import {
    transformChainsToAppKitNetworks,
    extractTokenConfigs,
} from "./config";
import type { ProviderChainConfig } from "@kulupay/core";

export interface KuluPayAppKitInstance {
    /** The AppKit modal instance */
    modal: ReturnType<typeof createAppKit>;
    /** Wagmi config for @wagmi/core actions */
    wagmiConfig: WagmiConfig;
    /** Chain configs from the server */
    chains: ProviderChainConfig[];
    /** Token configs grouped by chain ID */
    tokensByChain: Record<number, Record<string, { symbol: string; decimals: number; contractAddress?: string }>>;

    // Wallet connection
    open: () => void;
    close: () => void;
    isConnected: () => boolean;
    getAddress: () => string | null;
    getChainId: () => number | string | undefined;
    disconnect: () => void;

    // Balance
    getBalance: (address?: string) => Promise<{ formatted: string; symbol: string; value: bigint } | null>;

    // Send EVM transaction (vanilla, no React)
    sendEVMTx: (tx: { to: string; value?: bigint; data?: string }) => Promise<string>;

    // Switch chain
    switchChain: (chainId: number) => Promise<void>;

    // Subscribe to provider changes
    subscribeProvider: (handler: (state: any) => void) => void;
}

export interface CreateKuluPayAppKitOptions {
    /** Reown project ID from dashboard.reown.com */
    projectId: string;
    /** Chain configs from the server context (pay.$context.providers) */
    chains: ProviderChainConfig[];
    /** App metadata for WalletConnect */
    metadata?: {
        name: string;
        description: string;
        url: string;
        icons: string[];
    };
    /** Reown AppKit theme options for UI customization */
    themeOptions?: {
        themeMode?: "dark" | "light" | "auto";
        themeVariables?: Record<string, string>;
        customWallets?: any[];
        enableWallets?: any[];
        featuredWallets?: string[];
    };
}

/**
 * Create a KuluPay AppKit instance — vanilla JS, no React.
 *
 * Takes chain configs and projectId directly — no fetching, no /config endpoint.
 * The caller passes chains from the server context or from intent metadata.
 *
 * @internal Called by the onchain client plugin or React provider.
 */
export function createKuluPayAppKit(
    options: CreateKuluPayAppKitOptions,
    createAppKitImpl: (options: any) => any = createAppKit,
): KuluPayAppKitInstance {
    const { projectId, chains, metadata: customMetadata } = options;

    if (!projectId) {
        throw new Error(
            "KuluPay: walletConnectProjectId is required for onchain payments. " +
            "Get one at https://dashboard.reown.com",
        );
    }

    if (chains.length === 0) {
        throw new Error(
            "KuluPay: No onchain providers configured. " +
            "AppKit requires at least one onchain provider (ethereum, tron, etc.).",
        );
    }

    const { evm, tron, all } = transformChainsToAppKitNetworks(chains);
    const tokensByChain = extractTokenConfigs(chains);

    const wagmiAdapter = new WagmiAdapter({
        networks: evm,
        projectId,
    });

    const adapters: any[] = [wagmiAdapter];
    if (tron.length > 0) {
        const tronAdapter = new TronAdapter({
            walletAdapters: [new TronLinkAdapter()],
        });
        adapters.push(tronAdapter);
    }

    const metadata = customMetadata ?? {
        name: "KuluPay",
        description: "Pay with crypto",
        url: typeof window !== "undefined" ? window.location.origin : "https://kulupay.com",
        icons: [],
    };

    const modal = createAppKitImpl({
        adapters,
        networks: all as [typeof all[number], ...typeof all],
        projectId,
        metadata,
        features: {
            analytics: false,
            socialTypes: [],
            email: false,
            swaps: false,
            onramp: false,
        },
        themeMode: "dark",
        ...options.themeOptions,
    });

    const wagmiConfig = wagmiAdapter.wagmiConfig;

    return {
        modal,
        wagmiConfig,
        chains,
        tokensByChain,

        open: () => modal.open(),
        close: () => modal.close(),
        isConnected: () => {
            const acc = getAccount(wagmiConfig);
            return acc.isConnected;
        },
        getAddress: () => modal.getAddress() ?? null,
        getChainId: () => modal.getChainId(),
        disconnect: () => {
            disconnect(wagmiConfig);
        },

        getBalance: async (address?: string) => {
            const addr = address ?? modal.getAddress();
            if (!addr) return null;
            try {
                const balance = await getBalance(wagmiConfig, { address: addr as `0x${string}` });
                return {
                    formatted: balance.formatted,
                    symbol: balance.symbol,
                    value: balance.value,
                };
            } catch {
                return null;
            }
        },

        sendEVMTx: async (tx: { to: string; value?: bigint; data?: string }) => {
            const hash = await sendTransaction(wagmiConfig, {
                to: tx.to as `0x${string}`,
                value: tx.value ?? BigInt(0),
                data: tx.data as `0x${string}` | undefined,
            });
            return hash;
        },

        switchChain: async (chainId: number) => {
            await switchChain(wagmiConfig, { chainId });
        },

        subscribeProvider: (handler: (state: any) => void) => {
            modal.subscribeProviders(handler);
        },
    };
}
