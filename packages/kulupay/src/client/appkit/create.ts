import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { TronAdapter } from "@reown/appkit-adapter-tron";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { OkxWalletAdapter } from "@tronweb3/tronwallet-adapter-okxwallet";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { TokenPocketAdapter } from "@tronweb3/tronwallet-adapter-tokenpocket";
import { BybitWalletAdapter } from "@tronweb3/tronwallet-adapter-bybit";
import { TrustAdapter } from "@tronweb3/tronwallet-adapter-trust";
import { sendTransaction, getBalance, getAccount, disconnect } from "@wagmi/core";
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
 * Patch TronAdapter.getBalance to query the configured Tron RPC directly via
 * TronWeb instead of Reown's BlockchainApiController, which frequently returns
 * 503 for Tron balance reads.
 */
function patchTronAdapterBalance(
    tronAdapter: any,
    chains: ProviderChainConfig[],
    networks: any[],
) {
    const tronChain = chains.find((c) => c.family === "tron");
    const network = networks[0];
    if (!tronChain && !network) return;

    const rpcUrls =
        network?.rpcUrls?.default?.http ||
        [tronChain?.rpcUrl].filter(Boolean);

    tronAdapter.getBalance = async (params: any) => {
        const address = params?.address;
        if (!address || rpcUrls.length === 0) {
            return { balance: "0", symbol: "TRX" };
        }

        for (const rpcUrl of rpcUrls) {
            try {
                // @ts-ignore — tronweb is an optional peer dependency and may not be installed
                const TronWeb = (await import("tronweb")).default as any;
                const tw = new TronWeb({ fullHost: rpcUrl });
                const balanceInSun = await tw.trx.getBalance(address);
                return {
                    balance: (Number(balanceInSun) / 1e6).toString(),
                    symbol: "TRX",
                };
            } catch {
                // Try the next fallback RPC
            }
        }

        return { balance: "0", symbol: "TRX" };
    };
}

/**
 * Create a KuluPay AppKit instance — vanilla JS, no React.
 *
 * Takes chain configs and projectId directly — no fetching, no /config endpoint.
 * The caller passes chains from the server context (pay.$context.providers)
 * or from intent metadata.
 *
 * @internal Called by KuluPayAppKitProvider or createPayClient.
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

    // 1. Transform chains to AppKit networks
    const { evm, tron, all } = transformChainsToAppKitNetworks(chains);
    const tokensByChain = extractTokenConfigs(chains);

    // 2. Create WagmiAdapter for EVM chains
    // If there are no EVM chains (Tron-only), add a fallback Ethereum mainnet
    // so WagmiAdapter can initialize — the Tron adapter handles the actual tx
    const evmNetworks = evm.length > 0 ? evm : [{
        id: 1,
        caipNetworkId: "eip155:1",
        chainNamespace: "eip155" as const,
        name: "Ethereum",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: ["https://eth.llamarpc.com"] } },
        blockExplorers: { default: { name: "Etherscan", url: "https://etherscan.io" } },
    }];
    const wagmiAdapter = new WagmiAdapter({
        networks: evmNetworks as any,
        projectId,
    });

    // 3. Create TronAdapter for Tron chains (if any)
    // Only include WagmiAdapter in AppKit when there are actual EVM chains.
    // For Tron-only payments, passing WagmiAdapter (with its fallback EVM network)
    // causes AppKit to show an EVM network selector that confuses users.
    const adapters: any[] = [];
    if (evm.length > 0) {
        adapters.push(wagmiAdapter);
    }
    if (tron.length > 0) {
        const tronAdapter = new TronAdapter({
            walletAdapters: [
                new TronLinkAdapter(),
                new OkxWalletAdapter(),
                new BitKeepAdapter(),
                new TokenPocketAdapter(),
                new BybitWalletAdapter(),
                new TrustAdapter(),
            ],
        });
        patchTronAdapterBalance(tronAdapter, chains, tron);
        adapters.push(tronAdapter);
    }

    // 4. Create the AppKit modal
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
        customWallets: [
            ...(options.themeOptions?.customWallets ?? []),
            {
                id: "tron-okx",
                name: "OKX Wallet",
                homepage: "https://www.okx.com/web3",
                image_url: "https://static.okx.com/cdn/assets/imgs/247/8E7F7BCA28A77B23.png",
                desktop_link: "okxwallet://",
                mobile_link: "okx://",
                app_store: "https://apps.apple.com/app/okx-wallet/id3046397331",
                play_store: "https://play.google.com/store/apps/details?id=com.okex.wallet",
            },
            {
                id: "tron-tokenpocket",
                name: "TokenPocket",
                homepage: "https://www.tokenpocket.pro/",
                image_url: "https://www.tokenpocket.pro/static/logo.png",
                desktop_link: "tp://",
                mobile_link: "tp://",
                app_store: "https://apps.apple.com/app/tokenpocket/id1433618928",
                play_store: "https://play.google.com/store/apps/details?id=vip.mytokenpocket.android",
            },
            {
                id: "tron-bybit",
                name: "Bybit Wallet",
                homepage: "https://www.bybit.com/web3",
                image_url: "https://public.bybit.com/common/logo/logo.png",
                desktop_link: "bybitwallet://",
                mobile_link: "bybitwallet://",
                app_store: "https://apps.apple.com/app/bybit-wallet/id6471253723",
                play_store: "https://play.google.com/store/apps/details?id=com.bybit.wallet",
            },
            {
                id: "tron-trust",
                name: "Trust Wallet",
                homepage: "https://www.trustwallet.com/browser-extension",
                image_url: "https://trustwallet.com/assets/images/media/assets/trust_platform.svg",
                desktop_link: "trust://",
                mobile_link: "https://link.trustwallet.com",
                app_store: "https://apps.apple.com/app/trust-wallet-crypto/id1288339409",
                play_store: "https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp",
            },
        ],
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
            return acc.isConnected || !!modal.getAddress();
        },
        getAddress: () => {
            const acc = getAccount(wagmiConfig);
            return acc.address ?? modal.getAddress() ?? null;
        },
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

        subscribeProvider: (handler: (state: any) => void) => {
            modal.subscribeProviders(handler);
        },
    };
}
