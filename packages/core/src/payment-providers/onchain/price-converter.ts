import type { PriceConverter, PriceConversion } from "./types";

/**
 * Price converter for stablecoins (USDC, USDT, DAI, etc.).
 * Assumes 1 stablecoin = 1 USD, so the conversion is:
 *   cents → smallest units = amount * 10^decimals / 100
 *
 * Native tokens (ETH, TRX) are not supported by this converter.
 * To accept native tokens, provide a custom `priceConverter` with
 * a price feed (CoinGecko, Chainlink, etc.).
 */
export function stablecoinConverter(): PriceConverter {
    return async (amount, currency, token, _chain): Promise<PriceConversion> => {
        if (!token.contractAddress) {
            throw new Error(
                `Native token ${token.symbol} requires a custom priceConverter with a price feed. ` +
                `Use stablecoinConverter() for stablecoins only, or provide your own priceConverter.`,
            );
        }

        const fiatAmount = currency.toLowerCase() === "usd"
            ? amount / 100
            : amount;

        const cryptoAmount = BigInt(Math.round(fiatAmount * Math.pow(10, token.decimals)));
        return {
            cryptoAmount: cryptoAmount.toString(),
            tokenSymbol: token.symbol,
            rate: 1,
            rateTimestamp: new Date(),
        };
    };
}
