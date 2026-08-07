export type ChainFamily = "evm" | "tron";

export interface TokenConfig {
    symbol: string;
    decimals: number;
    contractAddress?: string;
}

export interface ChainConfig {
    family: ChainFamily;
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerUrl?: string;
    isTestnet?: boolean;
}

export interface PriceConversion {
    cryptoAmount: string;
    tokenSymbol: string;
    rate: number;
    rateTimestamp: Date;
}

export type PriceConverter = (
    amount: number,
    currency: string,
    token: TokenConfig,
    chain: ChainConfig,
) => Promise<PriceConversion>;

export interface OnchainPaymentMetadata {
    family: ChainFamily;
    chain: string;
    recipient: string;
    reference: string;
    token: TokenConfig;
    txHash?: string;
    priceConversion?: PriceConversion;
}
