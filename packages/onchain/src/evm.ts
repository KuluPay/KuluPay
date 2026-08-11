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

export interface EVMProviderOptions {
    /** Chain configuration */
    chain: ChainConfig;
    /** Recipient wallet address (0x...) */
    recipientAddress: `0x${string}`;
    /** Tokens accepted on this chain (key = token symbol or "native") */
    tokens: Record<string, TokenConfig>;
    /** Optional price converter for fiat → crypto */
    priceConverter?: PriceConverter;
    /** Number of confirmations to wait for (default: 1) */
    confirmations?: number;
    /** Provider ID (defaults to chain name) */
    id?: string;
}

function generateReference(): string {
    return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateClientSecret(): string {
    return `sec_${crypto.randomUUID()}`;
}

function encodeERC20Transfer(
    to: `0x${string}`,
    amount: bigint,
): `0x${string}` {
    const selector = "0xa9059cbb";
    const paddedTo = to.slice(2).toLowerCase().padStart(64, "0");
    const paddedAmount = amount.toString(16).padStart(64, "0");
    return `${selector}${paddedTo}${paddedAmount}` as `0x${string}`;
}

export const evm = (options: EVMProviderOptions): PaymentProvider => {
    if (options.chain.family !== "evm") {
        throw new ProviderError(
            `EVM provider requires chain family "evm", got "${options.chain.family}"`,
            "evm",
        );
    }

    const providerId = options.id ?? options.chain.name;
    const confirmations = options.confirmations ?? 1;

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

            const amountBigInt = BigInt(cryptoAmount);
            const isNative = !token.contractAddress;

            const metadata: OnchainPaymentMetadata = {
                family: "evm",
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
                    to: isNative
                        ? options.recipientAddress
                        : (token.contractAddress as `0x${string}`).toLowerCase() as `0x${string}`,
                    value: isNative
                        ? amountBigInt.toString()
                        : "0",
                    data: isNative
                        ? "0x"
                        : encodeERC20Transfer(
                              options.recipientAddress,
                              amountBigInt,
                          ),
                    chainId: options.chain.chainId,
                    tokenSymbol: token.symbol,
                    isNative,
                },
            };
        },

        getIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const { createPublicClient, http, parseAbiItem, decodeEventLog } = await import("viem");

                const client = createPublicClient({
                    chain: {
                        id: options.chain.chainId,
                        name: options.chain.name,
                        nativeCurrency: {
                            name: "Ether",
                            symbol: "ETH",
                            decimals: 18,
                        },
                        rpcUrls: {
                            default: { http: [options.chain.rpcUrl] },
                        },
                    } as any,
                    transport: http(options.chain.rpcUrl),
                });

                if (id.startsWith("0x") && id.length === 66) {
                    let receipt: any;
                    try {
                        receipt = await client.getTransactionReceipt({
                            hash: id as `0x${string}`,
                        });
                    } catch (lookupError: any) {
                        // Transaction not yet mined — return pending
                        const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "ETH", decimals: 18 };
                        return {
                            id,
                            amount: 0,
                            currency: fallbackToken.symbol,
                            status: "pending",
                            metadata: {
                                family: "evm",
                                chain: options.chain.name,
                                recipient: options.recipientAddress,
                                reference: id,
                                token: fallbackToken,
                                txHash: id,
                            },
                            raw: { lookupError: lookupError?.message },
                        };
                    }

                    // viem's TransactionReceipt has no `confirmations` field —
                    // derive it from the current block height.
                    const currentBlock = await client.getBlockNumber();
                    const confirmationCount =
                        currentBlock - receipt.blockNumber + 1n;

                    const confirmed =
                        receipt.status === "success" &&
                        confirmationCount >= BigInt(confirmations);

                    const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "ETH", decimals: 18 };
                    const token = Object.values(options.tokens).find(t => t.contractAddress === receipt.to) ?? fallbackToken;

                    // Parse Transfer events from receipt logs to extract the
                    // actual on-chain recipient and amount for verification.
                    let onchainRecipient: string | undefined;
                    let onchainAmount: string | undefined;
                    try {
                        const transferEvent = parseAbiItem(
                            "event Transfer(address indexed from, address indexed to, uint256 value)",
                        );
                        for (const log of receipt.logs ?? []) {
                            try {
                                const decoded = decodeEventLog({
                                    abi: [transferEvent],
                                    data: log.data,
                                    topics: log.topics,
                                });
                                if (decoded.eventName === "Transfer") {
                                    onchainRecipient = (decoded.args as any).to;
                                    onchainAmount = (decoded.args as any).value?.toString();
                                    break;
                                }
                            } catch {}
                        }
                    } catch {}

                    // For native transfers, get amount from the tx itself
                    if (!onchainAmount && receipt.status === "success") {
                        try {
                            const tx = await client.getTransaction({ hash: id as `0x${string}` });
                            if (tx.value > 0n) {
                                onchainRecipient = tx.to ?? undefined;
                                onchainAmount = tx.value.toString();
                            }
                        } catch {}
                    }

                    const status: PaymentIntent["status"] = confirmed
                        ? "succeeded"
                        : receipt.status === "reverted"
                            ? "failed"
                            : "pending";

                    return {
                        id,
                        amount: 0,
                        currency: token.symbol,
                        status,
                        metadata: {
                            family: "evm",
                            chain: options.chain.name,
                            recipient: options.recipientAddress,
                            reference: id,
                            token,
                            txHash: id,
                            onchainRecipient,
                            onchainAmount,
                        },
                        raw: receipt,
                    };
                }

                const erc20Tokens = Object.values(options.tokens).filter(t => t.contractAddress);
                for (const token of erc20Tokens) {
                    const logs = await client.getLogs({
                        address: token.contractAddress as `0x${string}`,
                        event: parseAbiItem(
                            "event Transfer(address indexed from, address indexed to, uint256 value)",
                        ),
                        args: {
                            to: options.recipientAddress,
                        },
                        fromBlock: "latest",
                        toBlock: "latest",
                    });

                    for (const log of logs) {
                        if (log.transactionHash) {
                            const receipt = await client.getTransactionReceipt({
                                hash: log.transactionHash,
                            });
                            if (receipt.status === "success") {
                                return {
                                    id,
                                    amount: 0,
                                    currency: token.symbol,
                                    status: "succeeded",
                                    metadata: {
                                        family: "evm",
                                        chain: options.chain.name,
                                        recipient: options.recipientAddress,
                                        reference: id,
                                        token,
                                        txHash: log.transactionHash,
                                    },
                                    raw: receipt,
                                };
                            }
                        }
                    }
                }

                const fallbackToken = options.tokens["native"] ?? Object.values(options.tokens)[0] ?? { symbol: "ETH", decimals: 18 };
                return {
                    id,
                    amount: 0,
                    currency: fallbackToken.symbol,
                    status: "pending",
                    metadata: {
                        family: "evm",
                        chain: options.chain.name,
                        recipient: options.recipientAddress,
                        reference: id,
                        token: fallbackToken,
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
                currency: options.tokens["native"]?.symbol ?? "ETH",
                status: "canceled",
                metadata: {
                    family: "evm",
                    chain: options.chain.name,
                    recipient: options.recipientAddress,
                    reference: id,
                    token: options.tokens["native"]!,
                },
            };
        },

        refund: async (id: string, amount?: number): Promise<PaymentIntent> => {
            try {
                const { createWalletClient, http, parseEther, parseUnits } =
                    await import("viem");
                const { privateKeyToAccount } = await import("viem/accounts");

                const privateKey = process.env.EVM_REFUND_PRIVATE_KEY;
                if (!privateKey) {
                    throw new ProviderError(
                        "EVM_REFUND_PRIVATE_KEY not set — cannot process refunds",
                        providerId,
                    );
                }

                const account = privateKeyToAccount(
                    privateKey as `0x${string}`,
                );

                const walletClient = createWalletClient({
                    account,
                    chain: {
                        id: options.chain.chainId,
                        name: options.chain.name,
                        nativeCurrency: {
                            name: "Ether",
                            symbol: "ETH",
                            decimals: 18,
                        },
                        rpcUrls: {
                            default: { http: [options.chain.rpcUrl] },
                        },
                    } as any,
                    transport: http(options.chain.rpcUrl),
                });

                const { createPublicClient } = await import("viem");
                const publicClient = createPublicClient({
                    chain: {
                        id: options.chain.chainId,
                        name: options.chain.name,
                        nativeCurrency: {
                            name: "Ether",
                            symbol: "ETH",
                            decimals: 18,
                        },
                        rpcUrls: {
                            default: { http: [options.chain.rpcUrl] },
                        },
                    } as any,
                    transport: http(options.chain.rpcUrl),
                });

                if (!id.startsWith("0x") || id.length !== 66) {
                    throw new ProviderError(
                        "Refund requires a transaction hash",
                        providerId,
                    );
                }

                const tx = await publicClient.getTransaction({
                    hash: id as `0x${string}`,
                });

                const isNative = !tx.data || tx.data === "0x";
                const token = isNative
                    ? options.tokens["native"]!
                    : Object.values(options.tokens).find(t => t.contractAddress?.toLowerCase() === tx.to?.toLowerCase()) ?? options.tokens["native"]!;

                const refundAmount = amount
                    ? BigInt(amount)
                    : (tx.value ?? 0n);

                if (isNative) {
                    const hash = await walletClient.sendTransaction({
                        to: tx.from as `0x${string}`,
                        value: refundAmount,
                    } as any);

                    return {
                        id: hash,
                        amount: Number(refundAmount),
                        currency: token.symbol,
                        status: "succeeded",
                        metadata: {
                            family: "evm",
                            chain: options.chain.name,
                            recipient: tx.from,
                            reference: id,
                            token,
                            txHash: hash,
                        },
                        raw: { refundTxHash: hash, originalTxHash: id },
                    };
                }

                const hash = await walletClient.sendTransaction({
                    to: token.contractAddress as `0x${string}`,
                    data: encodeERC20Transfer(
                        tx.from as `0x${string}`,
                        refundAmount,
                    ),
                } as any);

                return {
                    id: hash,
                    amount: Number(refundAmount),
                    currency: token.symbol,
                    status: "succeeded",
                    metadata: {
                        family: "evm",
                        chain: options.chain.name,
                        recipient: tx.from,
                        reference: id,
                        token,
                        txHash: hash,
                    },
                    raw: { refundTxHash: hash, originalTxHash: id },
                };
            } catch (error: any) {
                throw new ProviderError(error.message, providerId);
            }
        },
    };
};
