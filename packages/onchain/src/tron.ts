import type {
    PaymentProvider,
    PaymentIntent,
    CreateIntentData,
} from "@kulupay/core";
import { ProviderError } from "@kulupay/core/error";
import type {
    ChainConfig,
    TokenConfig,
    PriceConverter,
    OnchainPaymentMetadata,
} from "./types";

export { ProviderError };

async function getTronWebClass(): Promise<any> {
    const mod: any = await import("tronweb");
    return mod.TronWeb ?? mod.default?.TronWeb ?? mod.default;
}

export interface TronProviderOptions {
    /** Chain configuration (family must be "tron") */
    chain: ChainConfig;
    /** Recipient wallet address (Base58 or hex) */
    recipientAddress: string;
    /** Tokens accepted on this chain (key = token symbol or "native") */
    tokens: Record<string, TokenConfig>;
    /** Optional price converter for fiat → crypto */
    priceConverter?: PriceConverter;
    /** Provider ID (defaults to chain name) */
    id?: string;
    /** TronGrid API key (optional, for higher rate limits) */
    apiKey?: string;
}

function generateReference(): string {
    return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateClientSecret(): string {
    return `sec_${crypto.randomUUID()}`;
}

export const tron = (options: TronProviderOptions): PaymentProvider => {
    if (options.chain.family !== "tron") {
        throw new ProviderError(
            `Tron provider requires chain family "tron", got "${options.chain.family}"`,
            "tron",
        );
    }

    const providerId = options.id ?? options.chain.name;

    function resolveToken(data: CreateIntentData): TokenConfig {
        const tokenKey = (data.token ?? data.metadata?.token ?? "native") as string;
        const token = options.tokens[tokenKey];
        if (!token) {
            throw new ProviderError(
                `Token "${tokenKey}" not supported on chain "${options.chain.name}". Available: ${Object.keys(options.tokens).join(", ")}`,
                providerId,
            );
        }
        return token;
    }

    return {
        id: providerId,
        checkout: "self-hosted",
        chainConfig: {
            family: options.chain.family,
            chainId: options.chain.chainId,
            name: options.chain.name,
            rpcUrl: options.chain.rpcUrl,
            explorerUrl: options.chain.explorerUrl,
            isTestnet: options.chain.isTestnet,
            tokens: options.tokens,
        },

        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            const reference =
                (data.metadata?.reference as string) || generateReference();

            const token = resolveToken(data);

            let cryptoAmount: string;
            let priceConversion: OnchainPaymentMetadata["priceConversion"];

            if (options.priceConverter) {
                const result = await options.priceConverter(
                    data.amount,
                    data.currency,
                    token,
                    options.chain,
                );
                cryptoAmount = result.cryptoAmount;
                priceConversion = result;
            } else {
                cryptoAmount = data.amount.toString();
            }

            const isNative = !token.contractAddress;

            const metadata: OnchainPaymentMetadata = {
                family: "tron",
                chain: options.chain.name,
                recipient: options.recipientAddress,
                reference,
                token,
                priceConversion,
            };

            return {
                id: reference,
                amount: data.amount,
                currency: data.currency,
                status: "pending",
                clientSecret: generateClientSecret(),
                metadata: {
                    ...data.metadata,
                    ...metadata,
                },
                raw: {
                    to: options.recipientAddress,
                    amount: cryptoAmount,
                    token: token.symbol,
                    isNative,
                    contractAddress: token.contractAddress,
                },
            };
        },

        getIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const TronWeb = await getTronWebClass();

                const tw = new TronWeb({
                    fullHost: options.chain.rpcUrl,
                    headers: options.apiKey
                        ? { "TRON-PRO-API-KEY": options.apiKey }
                        : undefined,
                });

                if (/^[0-9a-fA-F]{64}$/.test(id)) {
                    let tx: any;
                    try {
                        tx = await tw.trx.getTransaction(id);
                    } catch (lookupError: any) {
                        // Transaction not yet indexed by the Tron API —
                        // return pending instead of throwing a 502.
                        const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "TRX", decimals: 6 };
                        return {
                            id,
                            amount: 0,
                            currency: fallbackToken.symbol,
                            status: "pending",
                            metadata: {
                                family: "tron",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token: fallbackToken,
                                txHash: id,
                            },
                            raw: { lookupError: lookupError?.message },
                        };
                    }

                    if (!tx || tx.Error || (tx.code && tx.code !== "SUCCESS")) {
                        const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "TRX", decimals: 6 };
                        return {
                            id,
                            amount: 0,
                            currency: fallbackToken.symbol,
                            status: "failed",
                            metadata: {
                                family: "tron",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token: fallbackToken,
                                txHash: id,
                            },
                            raw: tx,
                        };
                    }

                    const confirmed = tx.ret?.[0]?.contractRet === "success";

                    const contractAddress = tx.raw_data?.contract?.[0]?.parameter?.value?.contract_address;
                    const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "TRX", decimals: 6 };
                    const token = contractAddress
                        ? Object.values(options.tokens).find(t => t.contractAddress === contractAddress) ?? fallbackToken
                        : fallbackToken;

                    // Extract actual on-chain recipient and amount for verification.
                    let onchainRecipient: string | undefined;
                    let onchainAmount: string | undefined;
                    try {
                        const paramValue = tx.raw_data?.contract?.[0]?.parameter?.value;
                        if (paramValue?.contract_address && paramValue?.data) {
                            // TRC20 transfer: data = selector(4) + to(32) + amount(32)
                            const data = paramValue.data.replace(/^0x/, "");
                            if (data.length >= 128) {
                                const toHex = "41" + data.slice(8, 72).slice(-40);
                                onchainRecipient = TronWeb.address.fromHex(toHex);
                                onchainAmount = BigInt("0x" + data.slice(72, 136)).toString();
                            }
                        } else if (paramValue?.to && paramValue?.amount) {
                            // Native TRX transfer
                            onchainRecipient = TronWeb.address.fromHex(paramValue.to);
                            onchainAmount = String(paramValue.amount);
                        }
                    } catch {}

                    return {
                        id,
                        amount: 0,
                        currency: token.symbol,
                        status: confirmed ? "succeeded" : "pending",
                        metadata: {
                            family: "tron",
                            chain: options.chain.name,
                            recipient: options.recipientAddress,
                            reference: id,
                            token,
                            txHash: id,
                            onchainRecipient,
                            onchainAmount,
                        },
                        raw: tx,
                    };
                }

                const trc20Tokens = Object.values(options.tokens).filter(t => t.contractAddress);
                for (const token of trc20Tokens) {
                    const contract = await tw.contract().at(
                        token.contractAddress!,
                    );
                    const events = await contract
                        .Transfer({
                            to: options.recipientAddress,
                        })
                        .get();

                    if (events && events.length > 0) {
                        const latestEvent = events[0];
                        const txHash = (latestEvent as any).transaction_id;
                        if (txHash) {
                            const tx = await tw.trx.getTransaction(txHash);
                            const confirmed =
                                tx.ret?.[0]?.contractRet === "success";

                            return {
                                id,
                                amount: 0,
                                currency: token.symbol,
                                status: confirmed
                                    ? "succeeded"
                                    : "pending",
                                metadata: {
                                    family: "tron",
                                    chain: options.chain.name,
                                    recipient: options.recipientAddress,
                                    reference: id,
                                    token,
                                    txHash,
                                },
                                raw: latestEvent,
                            };
                        }
                    }
                }

                if (options.tokens["native"]) {
                    const txs = await tw.trx.getTransactionsRelated(
                        options.recipientAddress,
                        "to",
                        20,
                    );

                    if (txs && txs.length > 0) {
                        const latestTx = txs[0];
                        const confirmed =
                            latestTx.ret?.[0]?.contractRet === "success";

                        return {
                            id,
                            amount: 0,
                            currency: options.tokens["native"].symbol,
                            status: confirmed ? "succeeded" : "pending",
                            metadata: {
                                family: "tron",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token: options.tokens["native"],
                                txHash: latestTx.txID,
                            },
                            raw: latestTx,
                        };
                    }
                }

                const fallbackToken2 = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "TRX", decimals: 6 };
                return {
                    id,
                    amount: 0,
                    currency: fallbackToken2.symbol,
                    status: "pending",
                    metadata: {
                        family: "tron",
                        chain: options.chain.name,
                        recipient: options.recipientAddress,
                        reference: id,
                        token: fallbackToken2,
                    },
                };
            } catch (error: any) {
                throw new ProviderError(error.message, providerId);
            }
        },

        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            return {
                id,
                amount: 0,
                currency: options.tokens["native"]?.symbol ?? "TRX",
                status: "canceled",
                metadata: {
                    family: "tron",
                    chain: options.chain.name,
                    recipient: options.recipientAddress,
                    reference: id,
                    token: options.tokens["native"]!,
                },
            };
        },

        refund: async (id: string, amount?: number): Promise<PaymentIntent> => {
            try {
                const TronWeb = await getTronWebClass();

                const privateKey = process.env.TRON_REFUND_PRIVATE_KEY;
                if (!privateKey) {
                    throw new ProviderError(
                        "TRON_REFUND_PRIVATE_KEY not set — cannot process refunds",
                        providerId,
                    );
                }

                const tw = new TronWeb({
                    fullHost: options.chain.rpcUrl,
                    privateKey,
                    headers: options.apiKey
                        ? { "TRON-PRO-API-KEY": options.apiKey }
                        : undefined,
                });

                if (!/^[0-9a-fA-F]{64}$/.test(id)) {
                    throw new ProviderError(
                        "Refund requires a transaction hash",
                        providerId,
                    );
                }

                const tx = await tw.trx.getTransaction(id);
                const sender = tx.raw_data?.contract?.[0]?.parameter?.value
                    ?.owner_address;

                if (!sender) {
                    throw new ProviderError(
                        "Could not determine sender from transaction",
                        providerId,
                    );
                }

                const senderBase58 = TronWeb.address.fromHex(sender);

                const contractAddress = tx.raw_data?.contract?.[0]?.parameter?.value?.contract_address;
                const isNative = !contractAddress;
                const token = isNative
                    ? options.tokens["native"]!
                    : Object.values(options.tokens).find(t => t.contractAddress === contractAddress) ?? options.tokens["native"]!;

                if (isNative) {
                    const refundAmount =
                        amount ?? tx.raw_data?.contract?.[0]?.parameter?.value
                            ?.amount ?? 0;

                    const txHash = await tw.trx.sendTransaction(
                        senderBase58,
                        refundAmount,
                    );

                    return {
                        id: txHash,
                        amount: refundAmount,
                        currency: token.symbol,
                        status: "succeeded",
                        metadata: {
                            family: "tron",
                            chain: options.chain.name,
                            recipient: senderBase58,
                            reference: id,
                            token,
                            txHash,
                        },
                        raw: { refundTxHash: txHash, originalTxHash: id },
                    };
                }

                const contract = await tw
                    .contract()
                    .at(token.contractAddress!);
                const refundAmount = amount ?? 0;

                const txHash = await contract
                    .transfer(senderBase58, refundAmount)
                    .send();

                return {
                    id: typeof txHash === "string" ? txHash : txHash?.txID,
                    amount: refundAmount,
                    currency: token.symbol,
                    status: "succeeded",
                    metadata: {
                        family: "tron",
                        chain: options.chain.name,
                        recipient: senderBase58,
                        reference: id,
                        token,
                        txHash: typeof txHash === "string" ? txHash : txHash?.txID,
                    },
                    raw: { refundTxHash: txHash, originalTxHash: id },
                };
            } catch (error: any) {
                throw new ProviderError(error.message, providerId);
            }
        },
    };
};
