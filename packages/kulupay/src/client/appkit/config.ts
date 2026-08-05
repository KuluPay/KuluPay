import type { ProviderChainConfig } from "@kulupay/core";

export type { ProviderChainConfig };

/**
 * Transform KuluPay chain configs into AppKit network definitions.
 *
 * EVM chains → viem-style chain definitions (eip155 namespace)
 * Tron chains → tron namespace chain definitions
 */
export function transformChainsToAppKitNetworks(chains: ProviderChainConfig[]) {
    const evmChains = chains.filter((c) => c.family === "evm");
    const tronChains = chains.filter((c) => c.family === "tron");

    return {
        evm: evmChains.map(toEvmNetwork),
        tron: tronChains.map(toTronNetwork),
        all: [...evmChains.map(toEvmNetwork), ...tronChains.map(toTronNetwork)],
    };
}

function toEvmNetwork(chain: ProviderChainConfig) {
    const nativeToken = chain.tokens["native"] ?? { symbol: "ETH", decimals: 18 };

    return {
        id: chain.chainId,
        caipNetworkId: `eip155:${chain.chainId}`,
        chainNamespace: "eip155" as const,
        name: chain.name,
        nativeCurrency: {
            name: nativeToken.symbol,
            symbol: nativeToken.symbol,
            decimals: nativeToken.decimals,
        },
        rpcUrls: {
            default: { http: [chain.rpcUrl] },
        },
        blockExplorers: chain.explorerUrl
            ? { default: { name: "Explorer", url: chain.explorerUrl } }
            : undefined,
    };
}

function toTronNetwork(chain: ProviderChainConfig) {
    const nativeToken = chain.tokens["native"] ?? { symbol: "TRX", decimals: 6 };

    return {
        id: chain.chainId,
        caipNetworkId: `tron:${chain.chainId}`,
        chainNamespace: "tron" as const,
        name: chain.name,
        nativeCurrency: {
            name: nativeToken.symbol,
            symbol: nativeToken.symbol,
            decimals: nativeToken.decimals,
        },
        rpcUrls: {
            default: { http: [chain.rpcUrl] },
        },
        blockExplorers: chain.explorerUrl
            ? { default: { name: "Explorer", url: chain.explorerUrl } }
            : undefined,
    };
}

/**
 * Extract token configs from chains, grouped by chain ID.
 * Used by the checkout to know which tokens are available per chain.
 */
export function extractTokenConfigs(chains: ProviderChainConfig[]) {
    const tokensByChain: Record<number, Record<string, { symbol: string; decimals: number; contractAddress?: string }>> = {};
    for (const chain of chains) {
        tokensByChain[chain.chainId] = chain.tokens;
    }
    return tokensByChain;
}
