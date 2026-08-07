import type { KuluPayPlugin } from "@kulupay/core";
import { buildOnchainProviders, type OnchainOptions, type OnchainChainConfig } from "./config";
import { onchainSchema } from "./schema";
import { ONCHAIN_ERROR_CODES, OnchainError, type OnchainErrorCode } from "./error-codes";

export type { OnchainOptions, OnchainChainConfig } from "./config";
export type { OnchainErrorCode, OnchainErrorContext, NetworkInfo } from "./error-codes";
export { ONCHAIN_ERROR_CODES, OnchainError } from "./error-codes";
export type { ChainFamily, TokenConfig, ChainConfig, PriceConversion, PriceConverter, OnchainPaymentMetadata } from "./types";
export { evm, type EVMProviderOptions } from "./evm";
export { tron, type TronProviderOptions } from "./tron";
export { stablecoinConverter } from "./price-converter";
export { NETWORKS, resolveNetwork, resolveChainKey, getDefaultTestnet, CHAIN_ALIASES, type NetworkConfig, type ChainNetworks, type ChainKey } from "./networks";

/**
 * Pre-configured token presets for common stablecoins and native tokens.
 */
export const TOKENS = {
    ETH: { symbol: "ETH", decimals: 18 },
    MATIC: { symbol: "MATIC", decimals: 18 },
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
    TRX: { symbol: "TRX", decimals: 6 },
} as const;

/**
 * Pre-configured chain presets.
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

/**
 * Onchain payment plugin for KuluPay.
 *
 * Encapsulates EVM and Tron payment providers with:
 * - Server-side raw transaction building (recipientAddress stays secret)
 * - Client-side wallet signing via AppKit (onchainClient plugin)
 * - Schema extensions for chainId, txHash, blockNumber
 * - Typed error codes for wallet/chain/transaction errors
 * - Full testnet support via `testnet: true` or `testnet: "sepolia"`
 *
 * @example
 * ```ts
 * kuluPay({
 *   plugins: [
 *     onchain({
 *       ethereum: { recipientAddress: "0x...", tokens: ["USDC", "native"], testnet: false },
 *       tron: { recipientAddress: "T...", tokens: ["USDT"], apiKey: "..." },
 *     }),
 *   ],
 * })
 * ```
 */
export const onchain = (options: OnchainOptions): KuluPayPlugin => {
    return {
        id: "onchain",

        async init(ctx) {
            const providers = buildOnchainProviders(options);

            for (const provider of providers) {
                ctx.providers.set(provider.id, provider);
            }

            ctx.logger.debug(
                `Onchain plugin initialized with ${providers.length} provider(s): ${providers.map(p => p.id).join(", ")}`,
            );
        },

        schema: onchainSchema,

        $ERROR_CODES: ONCHAIN_ERROR_CODES as unknown as Record<string, { code: string; message: string }>,

        $Infer: {
            ChainConfig: {} as import("./types").ChainConfig,
            TokenConfig: {} as import("./types").TokenConfig,
            OnchainPaymentMetadata: {} as import("./types").OnchainPaymentMetadata,
        },
    };
};
