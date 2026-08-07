import type { PaymentProvider } from "@kulupay/core";
import { evm, type EVMProviderOptions } from "./evm";
import { tron, type TronProviderOptions } from "./tron";
import {
    NETWORKS,
    resolveChainKey,
    resolveNetwork,
    getDefaultTestnet,
    type NetworkConfig,
} from "./networks";
import type { ChainConfig, TokenConfig, PriceConverter } from "./types";
import { stablecoinConverter } from "./price-converter";

export interface OnchainChainConfig {
    recipientAddress: string;
    tokens?: string | string[];
    testnet?: boolean | string;
    network?: Partial<NetworkConfig>;
    /** Custom price converter (overrides built-in stablecoin logic) */
    priceConverter?: PriceConverter;
    confirmations?: number;
    apiKey?: string;
}

/**
 * The onchain plugin options — flat, each key is a chain name.
 * @example
 * ```ts
 * onchain({
 *   ethereum: { recipientAddress: "0x...", tokens: ["USDC", "native"], testnet: false },
 *   tron: { recipientAddress: "T...", tokens: ["USDT"], apiKey: "..." },
 * })
 * ```
 */
export type OnchainOptions = Record<string, OnchainChainConfig>;

/**
 * Build PaymentProvider[] from the onchain plugin options.
 * Called by the plugin's init function.
 */
export function buildOnchainProviders(config: OnchainOptions): PaymentProvider[] {
    const providers: PaymentProvider[] = [];

    for (const [configKey, chainConfig] of Object.entries(config)) {
        if (!chainConfig) continue;

        const chainKey = resolveChainKey(configKey);
        const chain = NETWORKS[chainKey];

        let network: NetworkConfig;

        if (chainConfig.network) {
            network = {
                chainId: chainConfig.network.chainId ?? chain.mainnet.chainId,
                name: chainConfig.network.name ?? chain.mainnet.name,
                rpcUrl: chainConfig.network.rpcUrl ?? chain.mainnet.rpcUrl,
                explorerUrl: chainConfig.network.explorerUrl ?? chain.mainnet.explorerUrl,
                isTestnet: chainConfig.network.isTestnet ?? false,
                faucetUrl: chainConfig.network.faucetUrl,
            };
        } else if (chainConfig.testnet === false) {
            network = chain.mainnet;
        } else if (typeof chainConfig.testnet === "string") {
            network = resolveNetwork(chainKey, chainConfig.testnet);
        } else if (chainConfig.testnet === true) {
            const defaultTestnet = getDefaultTestnet(chainKey);
            if (!defaultTestnet) {
                network = chain.mainnet;
            } else {
                network = resolveNetwork(chainKey, defaultTestnet);
            }
        } else {
            network = chain.mainnet;
        }

        const tokens: Record<string, TokenConfig> = {};
        const tokenList: string[] = [];
        if (chainConfig.tokens) {
            if (Array.isArray(chainConfig.tokens)) {
                tokenList.push(...chainConfig.tokens);
            } else {
                tokenList.push(chainConfig.tokens);
            }
        }
        if (tokenList.length === 0) {
            tokenList.push("native");
        }

        for (const tokenKey of tokenList) {
            const isNative = tokenKey === "native";
            const tokenConfig: TokenConfig | undefined = isNative
                ? { symbol: chain.nativeToken.symbol, decimals: chain.nativeToken.decimals }
                : chain.wellKnownTokens[tokenKey];

            if (!isNative && !tokenConfig) {
                throw new Error(
                    `Unknown token "${tokenKey}" for chain ${configKey}. Available: ${Object.keys(chain.wellKnownTokens).join(", ")}, native`,
                );
            }

            let resolvedToken = tokenConfig;
            if (network.isTestnet && chain.testnetTokens) {
                const testnetKey = Object.keys(chain.testnets).find(
                    (k) => chain.testnets[k] === network || chain.testnets[k].name === network.name,
                );
                if (testnetKey && chain.testnetTokens[testnetKey]?.[tokenKey]) {
                    resolvedToken = chain.testnetTokens[testnetKey][tokenKey];
                }
            }

            const key = isNative ? "native" : tokenKey;
            tokens[key] = resolvedToken!;
        }

        const chainConfigResolved: ChainConfig = {
            family: chain.family,
            chainId: network.chainId,
            name: network.name,
            rpcUrl: network.rpcUrl,
            explorerUrl: network.explorerUrl,
            isTestnet: network.isTestnet,
        };

        const converter = chainConfig.priceConverter
            ?? stablecoinConverter();

        const providerId = configKey;

        if (chain.family === "evm") {
            providers.push(
                evm({
                    chain: chainConfigResolved,
                    recipientAddress: chainConfig.recipientAddress as `0x${string}`,
                    tokens,
                    priceConverter: converter,
                    confirmations: chainConfig.confirmations,
                    id: providerId,
                }),
            );
        } else if (chain.family === "tron") {
            providers.push(
                tron({
                    chain: chainConfigResolved,
                    recipientAddress: chainConfig.recipientAddress,
                    tokens,
                    priceConverter: converter,
                    id: providerId,
                    apiKey: chainConfig.apiKey,
                }),
            );
        }
    }

    return providers;
}
