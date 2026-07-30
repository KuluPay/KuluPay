export { evm } from "./evm";
export type { EVMProviderOptions } from "./evm";

export { tron } from "./tron";
export type { TronProviderOptions } from "./tron";

export { BlockchainError, BLOCKCHAIN_ERROR_CODES } from "./errors";
export type { BlockchainErrorCode, BlockchainErrorContext, NetworkInfo } from "./errors";

export { blockchain } from "./config";
export type { BlockchainConfig, BlockchainChainConfig } from "./config";

export { stablecoinConverter } from "./price-converter";

export { NETWORKS, resolveNetwork, resolveChainKey, getDefaultTestnet, CHAIN_ALIASES } from "./networks";
export type { NetworkConfig, ChainNetworks, ChainKey } from "./networks";

export type {
    ChainFamily,
    TokenConfig,
    ChainConfig,
    PriceConversion,
    PriceConverter,
    BlockchainPaymentMetadata,
} from "./types";

/**
 * Pre-configured token presets for common stablecoins and native tokens.
 */
export const TOKENS = {
    // EVM native
    ETH: { symbol: "ETH", decimals: 18 },
    MATIC: { symbol: "MATIC", decimals: 18 },
    // ERC-20 stablecoins (contract addresses vary by chain — set at runtime)
    USDC: (contractAddress: string) => ({
        symbol: "USDC",
        decimals: 6,
        contractAddress,
    }),
    USDT: (contractAddress: string) => ({
        symbol: "USDT",
        decimals: 6,
        contractAddress,
    }),
    DAI: (contractAddress: string) => ({
        symbol: "DAI",
        decimals: 18,
        contractAddress,
    }),
    // Tron native
    TRX: { symbol: "TRX", decimals: 6 },
} as const;

/**
 * Pre-configured chain presets.
 * Contract addresses for tokens must be set per-chain.
 */
export const CHAINS = {
    ethereum: {
        family: "evm" as const,
        chainId: 1,
        name: "ethereum",
        rpcUrl: "https://eth.llamarpc.com",
        explorerUrl: "https://etherscan.io",
    },
    polygon: {
        family: "evm" as const,
        chainId: 137,
        name: "polygon",
        rpcUrl: "https://polygon-rpc.com",
        explorerUrl: "https://polygonscan.com",
    },
    base: {
        family: "evm" as const,
        chainId: 8453,
        name: "base",
        rpcUrl: "https://mainnet.base.org",
        explorerUrl: "https://basescan.org",
    },
    arbitrum: {
        family: "evm" as const,
        chainId: 42161,
        name: "arbitrum",
        rpcUrl: "https://arb1.arbitrum.io/rpc",
        explorerUrl: "https://arbiscan.io",
    },
    tron: {
        family: "tron" as const,
        chainId: 728126428,
        name: "tron",
        rpcUrl: "https://api.trongrid.io",
        explorerUrl: "https://tronscan.org",
    },
} as const;
