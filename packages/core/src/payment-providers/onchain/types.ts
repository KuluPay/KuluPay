/**
 * Supported onchain family types.
 * Each family has its own provider implementation.
 */
export type ChainFamily = "evm" | "tron";

/**
 * Token configuration for an onchain payment.
 * Supports both native tokens (ETH, TRX) and stablecoins (USDC, USDT).
 */
export interface TokenConfig {
    /** Token symbol, e.g. "USDC", "ETH", "TRX" */
    symbol: string;
    /** Contract address for ERC-20/TRC-20 tokens. Leave undefined for native token. */
    contractAddress?: string;
    /** Number of decimals (e.g. 6 for USDC, 18 for ETH) */
    decimals: number;
}

/**
 * Chain configuration for an onchain provider.
 */
export interface ChainConfig {
    /** Chain family — determines which SDK to use */
    family: ChainFamily;
    /** Chain ID (e.g. 1 for Ethereum, 137 for Polygon, 728126428 for Tron) */
    chainId: number;
    /** Human-readable chain name */
    name: string;
    /** RPC URL for reading on-chain data */
    rpcUrl: string;
    /** Block explorer URL (optional, for tx links) */
    explorerUrl?: string;
}

/**
 * Price conversion result — converts fiat amount to crypto amount.
 */
export interface PriceConversion {
    /** Amount in token's smallest unit (wei, sun, etc.) */
    cryptoAmount: string;
    /** Token symbol the amount is in */
    tokenSymbol: string;
    /** Exchange rate used (1 fiat = X crypto) */
    rate: number;
    /** Timestamp of the rate */
    rateTimestamp: Date;
}

/**
 * Optional price converter — converts fiat to crypto.
 * Implement this to integrate with an oracle (Chainlink, CoinGecko, etc.)
 */
export type PriceConverter = (
    amount: number,
    currency: string,
    token: TokenConfig,
    chain: ChainConfig,
) => Promise<PriceConversion>;

/**
 * Onchain payment intent metadata — stored alongside the standard PaymentIntent.
 */
export interface OnchainPaymentMetadata {
    /** Chain family */
    family: ChainFamily;
    /** Chain name */
    chain: string;
    /** Recipient wallet address */
    recipient: string;
    /** Unique reference for matching on-chain payments */
    reference: string;
    /** Token being used */
    token: TokenConfig;
    /** Transaction hash (once known) */
    txHash?: string;
    /** Price conversion details (if applicable) */
    priceConversion?: PriceConversion;
}
