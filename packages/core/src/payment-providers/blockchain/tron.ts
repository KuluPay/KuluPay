import {
    PaymentProvider,
    PaymentIntent,
    CreateIntentData,
} from "../../types";
import { ProviderError } from "../../error";
import type {
    ChainConfig,
    TokenConfig,
    PriceConverter,
    BlockchainPaymentMetadata,
} from "./types";

export interface TronProviderOptions {
    /** Chain configuration (family must be "tron") */
    chain: ChainConfig;
    /** Recipient wallet address (Base58 or hex) */
    recipientAddress: string;
    /** Token to accept (defaults to native TRX) */
    token?: TokenConfig;
    /** Optional price converter for fiat → crypto */
    priceConverter?: PriceConverter;
    /** Custom provider ID (defaults to `tron-{chain.name}`) */
    id?: string;
    /** TronGrid API key (optional, for higher rate limits) */
    apiKey?: string;
}

/**
 * Generate a unique payment reference.
 */
function generateReference(): string {
    return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const tron = (options: TronProviderOptions): PaymentProvider => {
    if (options.chain.family !== "tron") {
        throw new ProviderError(
            `Tron provider requires chain family "tron", got "${options.chain.family}"`,
            "tron",
        );
    }

    const token: TokenConfig = options.token ?? {
        symbol: "TRX",
        decimals: 6,
    };

    const providerId = options.id ?? `tron-${options.chain.name}`;

    return {
        id: providerId,
        checkout: "self-hosted",

        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            const reference =
                (data.metadata?.reference as string) || generateReference();

            let cryptoAmount: string;
            let priceConversion: BlockchainPaymentMetadata["priceConversion"];

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

            const metadata: BlockchainPaymentMetadata = {
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
                clientSecret: reference,
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
                // Dynamic import tronweb (optional dependency)
                const TronWeb = (await import("tronweb")).default;

                const tw = new TronWeb({
                    fullHost: options.chain.rpcUrl,
                    headers: options.apiKey
                        ? { "TRON-PRO-API-KEY": options.apiKey }
                        : undefined,
                });

                // If id is a tx hash (64 hex chars), check transaction
                if (/^[0-9a-fA-F]{64}$/.test(id)) {
                    const tx = await tw.trx.getTransaction(id);

                    if (!tx || tx.Error) {
                        return {
                            id,
                            amount: 0,
                            currency: token.symbol,
                            status: "failed",
                            metadata: {
                                family: "tron",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token,
                                txHash: id,
                            },
                            raw: tx,
                        };
                    }

                    const confirmed = tx.ret?.[0]?.contractRet === "success";

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
                        },
                        raw: tx,
                    };
                }

                // If id is a reference, check for incoming transactions
                // For TRC-20: query Transfer events to recipient
                if (token.contractAddress) {
                    const contract = await tw.contract().at(
                        token.contractAddress,
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
                } else {
                    // Native TRX: check recent transactions to recipient
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
                            currency: token.symbol,
                            status: confirmed ? "succeeded" : "pending",
                            metadata: {
                                family: "tron",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token,
                                txHash: latestTx.txID,
                            },
                            raw: latestTx,
                        };
                    }
                }

                return {
                    id,
                    amount: 0,
                    currency: token.symbol,
                    status: "pending",
                    metadata: {
                        family: "tron",
                        chain: options.chain.name,
                        recipient: options.recipientAddress,
                        reference: id,
                        token,
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
                currency: token.symbol,
                status: "canceled",
                metadata: {
                    family: "tron",
                    chain: options.chain.name,
                    recipient: options.recipientAddress,
                    reference: id,
                    token,
                },
            };
        },

        refund: async (id: string, amount?: number): Promise<PaymentIntent> => {
            try {
                const TronWeb = (await import("tronweb")).default;

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

                // Get original transaction
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
                const isNative = !token.contractAddress;

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

                // TRC-20 refund: trigger transfer on contract
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
