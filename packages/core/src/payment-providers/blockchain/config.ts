import type { PaymentProvider } from "../../types";
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

export interface BlockchainChainConfig {
    recipientAddress: string;
    tokens?: string | string[];
    testnet?: boolean | string;
    network?: Partial<NetworkConfig>;
    /** Custom price converter (overrides built-in stablecoin logic) */
    priceConverter?: PriceConverter;
    confirmations?: number;
    apiKey?: string;
}

export type BlockchainConfig = Record<string, BlockchainChainConfig>;

export function blockchain(config: BlockchainConfig): PaymentProvider[] {
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
        } else {
            const defaultTestnet = getDefaultTestnet(chainKey);
            if (!defaultTestnet) {
                network = chain.mainnet;
            } else {
                network = resolveNetwork(chainKey, defaultTestnet);
            }
        }

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

        const chainConfigResolved: ChainConfig = {
            family: chain.family,
            chainId: network.chainId,
            name: network.name,
            rpcUrl: network.rpcUrl,
            explorerUrl: network.explorerUrl,
        };

        const converter = chainConfig.priceConverter
            ?? stablecoinConverter();

        for (const tokenKey of tokenList) {
            const isNative = tokenKey === "native";
            const tokenConfig: TokenConfig | undefined = isNative
                ? undefined
                : chain.wellKnownTokens[tokenKey];

            if (!isNative && !tokenConfig) {
                throw new Error(
                    `Unknown token "${tokenKey}" for chain ${configKey}. Available: ${Object.keys(chain.wellKnownTokens).join(", ")}, native`,
                );
            }

            // Use testnet-specific token contract if available
            let resolvedToken = tokenConfig;
            if (network.isTestnet && chain.testnetTokens) {
                const testnetKey = Object.keys(chain.testnets).find(
                    (k) => chain.testnets[k] === network || chain.testnets[k].name === network.name,
                );
                if (testnetKey && chain.testnetTokens[testnetKey]?.[tokenKey]) {
                    resolvedToken = chain.testnetTokens[testnetKey][tokenKey];
                }
            }

            const providerId = isNative
                ? configKey
                : `${configKey}-${tokenKey.toLowerCase()}`;

            if (chain.family === "evm") {
                providers.push(
                    evm({
                        chain: chainConfigResolved,
                        recipientAddress: chainConfig.recipientAddress as `0x${string}`,
                        token: resolvedToken,
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
                        token: resolvedToken,
                        priceConverter: converter,
                        id: providerId,
                        apiKey: chainConfig.apiKey,
                    }),
                );
            }
        }
    }

    return providers;
}
