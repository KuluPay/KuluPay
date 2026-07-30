import type { ChainFamily } from "./types";

export interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerUrl: string;
    isTestnet: boolean;
    faucetUrl?: string;
}

export interface ChainNetworks {
    family: ChainFamily;
    displayName: string;
    mainnet: NetworkConfig;
    testnets: Record<string, NetworkConfig>;
    nativeToken: { symbol: string; decimals: number };
    wellKnownTokens: Record<string, { symbol: string; decimals: number; contractAddress: string }>;
    testnetTokens?: Record<string, Record<string, { symbol: string; decimals: number; contractAddress: string }>>;
}

export const NETWORKS: Record<string, ChainNetworks> = {
    ethereum: {
        family: "evm",
        displayName: "Ethereum",
        mainnet: {
            chainId: 1,
            name: "ethereum",
            rpcUrl: "https://eth.llamarpc.com",
            explorerUrl: "https://etherscan.io",
            isTestnet: false,
        },
        testnets: {
            sepolia: {
                chainId: 11155111,
                name: "sepolia",
                rpcUrl: "https://rpc.sepolia.org",
                explorerUrl: "https://sepolia.etherscan.io",
                isTestnet: true,
                faucetUrl: "https://sepoliafaucet.com",
            },
        },
        nativeToken: { symbol: "ETH", decimals: 18 },
        wellKnownTokens: {
            USDC: { symbol: "USDC", decimals: 6, contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
            USDT: { symbol: "USDT", decimals: 6, contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
        },
        testnetTokens: {
            sepolia: {
                USDC: { symbol: "USDC", decimals: 6, contractAddress: "0x1c7D4B196Cb0C5B537566C3aB4DdF2B53B3B3c7B" },
            },
        },
    },
    base: {
        family: "evm",
        displayName: "Base",
        mainnet: {
            chainId: 8453,
            name: "base",
            rpcUrl: "https://mainnet.base.org",
            explorerUrl: "https://basescan.org",
            isTestnet: false,
        },
        testnets: {
            "base-sepolia": {
                chainId: 84532,
                name: "base-sepolia",
                rpcUrl: "https://sepolia.base.org",
                explorerUrl: "https://sepolia.basescan.org",
                isTestnet: true,
                faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
            },
        },
        nativeToken: { symbol: "ETH", decimals: 18 },
        wellKnownTokens: {
            USDC: { symbol: "USDC", decimals: 6, contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
        },
        testnetTokens: {
            "base-sepolia": {
                USDC: { symbol: "USDC", decimals: 6, contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
            },
        },
    },
    tron: {
        family: "tron",
        displayName: "Tron",
        mainnet: {
            chainId: 728126428,
            name: "tron",
            rpcUrl: "https://api.trongrid.io",
            explorerUrl: "https://tronscan.org",
            isTestnet: false,
        },
        testnets: {
            nile: {
                chainId: 3448148188,
                name: "tron-nile",
                rpcUrl: "https://nile.trongrid.io",
                explorerUrl: "https://nile.tronscan.org",
                isTestnet: true,
                faucetUrl: "https://nileex.io/join/getJoinPage",
            },
            shasta: {
                chainId: 2494104990,
                name: "tron-shasta",
                rpcUrl: "https://api.shasta.trongrid.io",
                explorerUrl: "https://shasta.tronscan.org",
                isTestnet: true,
                faucetUrl: "https://shasta.tronlink.io",
            },
        },
        nativeToken: { symbol: "TRX", decimals: 6 },
        wellKnownTokens: {
            USDT: { symbol: "USDT", decimals: 6, contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
        },
        testnetTokens: {
            shasta: {
                USDT: { symbol: "USDT", decimals: 6, contractAddress: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs" },
            },
            nile: {
                USDT: { symbol: "USDT", decimals: 6, contractAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf" },
            },
        },
    },
};

export type ChainKey = keyof typeof NETWORKS;

export const CHAIN_ALIASES: Record<string, ChainKey> = {
    eth: "ethereum",
    base: "base",
    tron: "tron",
};

export function resolveChainKey(key: string): ChainKey {
    const resolved = CHAIN_ALIASES[key] ?? (key in NETWORKS ? (key as ChainKey) : undefined);
    if (!resolved) {
        throw new Error(
            `Unknown chain: "${key}". Available: ${Object.keys(CHAIN_ALIASES).join(", ")}`,
        );
    }
    return resolved;
}

export function resolveNetwork(
    chainKey: string,
    network: string,
): NetworkConfig {
    const chain = NETWORKS[chainKey];
    if (!chain) {
        throw new Error(`Unknown chain: ${chainKey}. Available: ${Object.keys(NETWORKS).join(", ")}`);
    }
    if (network === "mainnet") {
        return chain.mainnet;
    }
    const testnet = chain.testnets[network];
    if (!testnet) {
        throw new Error(
            `Unknown testnet "${network}" for chain ${chainKey}. Available: ${Object.keys(chain.testnets).join(", ")}`,
        );
    }
    return testnet;
}

export function getDefaultTestnet(chainKey: string): string | undefined {
    const chain = NETWORKS[chainKey];
    if (!chain) return undefined;
    const keys = Object.keys(chain.testnets);
    return keys[0];
}
