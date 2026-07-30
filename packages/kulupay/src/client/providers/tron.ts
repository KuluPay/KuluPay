import type {
    PaymentClientProvider,
    PaymentIntent,
    PaymentConfirmOptions,
} from "@kulupay/core";
import { BlockchainError, type NetworkInfo } from "@kulupay/core/payment-providers/blockchain";

export interface TronClientProviderOptions {
    /** Recipient address (Base58 format, e.g. "T...") */
    recipientAddress: string;
    /** TRC-20 token contract address (optional — undefined = native TRX) */
    tokenContractAddress?: string;
    /** Token decimals (default 6 for TRX, 6 for USDT) */
    tokenDecimals?: number;
    /** Provider ID — should match the server-side provider ID */
    id?: string;
    /** Network info for context-aware error messages */
    network?: NetworkInfo;
}

/**
 * Tron client provider — connects to the user's TronLink wallet
 * and confirms TRC-20 / TRX payments.
 *
 * Requires TronLink extension installed in the browser.
 * Uses window.tronWeb (injected by TronLink).
 */
export const createTronClientProvider = (
    options: TronClientProviderOptions,
): PaymentClientProvider => {
    const providerId = options.id ?? "tron";

    const getTronWeb = (): any => {
        if (typeof globalThis === "undefined") return null;
        const tw = (globalThis as any).tronWeb;
        if (!tw) {
            throw new BlockchainError("WALLET_NOT_FOUND");
        }
        return tw;
    };

    const ensureNetwork = (tw: any): void => {
        if (!options.network) return;
        const host = (tw.fullHost || tw.fullNode || "") as any;
        const actual = (typeof host === "string" ? host : host?.href || host?.host || "").toLowerCase();
        const expected = options.network.rpcUrl.toLowerCase().replace(/^https?:\/\//, "");

        if (!actual.includes(expected)) {
            throw new BlockchainError("WRONG_CHAIN", {
                expectedChain: options.network.name,
                actualChain: actual.includes("shasta") ? "tron-shasta"
                    : actual.includes("nile") ? "tron-nile"
                    : actual.includes("trongrid") && !actual.includes("shasta") ? "tron-mainnet"
                    : "unknown",
                network: options.network,
            });
        }
    };

    return {
        id: providerId,

        confirmPayment: async (
            clientSecret: string,
            confirmOptions?: PaymentConfirmOptions,
        ): Promise<PaymentIntent> => {
            const tw = getTronWeb();

            // Ensure wallet is connected
            if (!tw.defaultAddress || !tw.defaultAddress.base58) {
                throw new BlockchainError("WALLET_NOT_CONNECTED");
            }

            // Ensure TronLink is on the correct network
            ensureNetwork(tw);

            const fromAddress = tw.defaultAddress.base58;
            const intent = confirmOptions?.paymentMethodData as {
                to: string;
                amount: string;
                isNative: boolean;
                contractAddress?: string;
            };

            if (!intent) {
                throw new BlockchainError("MISSING_PAYMENT_DATA");
            }

            let txHash: any;

            try {
                if (intent.isNative || !intent.contractAddress) {
                    // Native TRX transfer
                    console.log("[KuluPay:Tron] Sending TRX:", {
                        to: intent.to,
                        amount: intent.amount,
                    });
                    txHash = await tw.trx.sendTransaction(
                        intent.to,
                        parseInt(intent.amount),
                    );
                } else {
                    // TRC-20 transfer — use TronLink's native contract API
                    console.log("[KuluPay:Tron] Sending TRC-20:", {
                        contract: intent.contractAddress,
                        to: intent.to,
                        amount: intent.amount,
                    });

                    // Pre-flight: verify the contract exists on this network
                    try {
                        const contractInfo = await tw.trx.getContract(intent.contractAddress);
                        if (!contractInfo || !contractInfo.contract_address) {
                            throw new BlockchainError("INVALID_CONTRACT", {
                                details: `Contract ${intent.contractAddress} not found on this network.`,
                                network: options.network,
                            });
                        }
                        console.log("[KuluPay:Tron] Contract verified:", contractInfo.name || intent.contractAddress);
                    } catch (verifyErr: any) {
                        if (verifyErr instanceof BlockchainError) throw verifyErr;
                        console.warn("[KuluPay:Tron] Contract verification failed:", verifyErr?.message);
                    }

                    // Use the high-level contract API — TronLink handles signing internally
                    const contract = await tw.contract().at(intent.contractAddress);
                    const result = await contract.transfer(intent.to, parseInt(intent.amount)).send({
                        feeLimit: 100_000_000,
                    });
                    txHash = result;
                }
                console.log("[KuluPay:Tron] Transaction result:", txHash);

                // Check for silent failure — sendRawTransaction returns { result: false } without throwing
                if (txHash && typeof txHash === "object" && txHash.result === false) {
                    throw new BlockchainError("TRANSACTION_FAILED", {
                        details: txHash.code ? `Code: ${txHash.code}` : "Transaction rejected by network",
                        network: options.network,
                    });
                }
            } catch (txError: any) {
                console.error("[KuluPay:Tron] Transaction error:", txError);
                if (txError instanceof BlockchainError) throw txError;
                throw BlockchainError.fromWalletError(txError, options.network);
            }

            // Extract txHash from various possible response formats
            const hashStr: string =
                typeof txHash === "string" ? txHash
                : (txHash as any)?.txid
                ?? (txHash as any)?.txID
                ?? (txHash as any)?.transaction?.txid
                ?? (txHash as any)?.id
                ?? "";

            return {
                id: hashStr,
                amount: 0,
                currency: "",
                status: "processing",
                metadata: {
                    txHash: hashStr,
                    from: fromAddress,
                    family: "tron",
                },
                raw: { txHash: hashStr },
            };
        },

        verifyPayment: async (clientSecret: string): Promise<PaymentIntent> => {
            const tw = getTronWeb();
            const txHash = clientSecret;

            try {
                const tx = await tw.trx.getTransaction(txHash);

                if (!tx || tx.Error) {
                    return {
                        id: txHash,
                        amount: 0,
                        currency: "",
                        status: "failed",
                        metadata: { txHash },
                        raw: tx,
                    };
                }

                const confirmed = tx.ret?.[0]?.contractRet === "success";

                return {
                    id: txHash,
                    amount: 0,
                    currency: "",
                    status: confirmed ? "succeeded" : "pending",
                    metadata: { txHash },
                    raw: tx,
                };
            } catch (error: any) {
                throw new BlockchainError("RPC_ERROR", { details: error.message }, error);
            }
        },

        getSDK: async () => {
            return getTronWeb();
        },
    };
};
