import type {
    PaymentClientProvider,
    PaymentIntent,
    PaymentConfirmOptions,
} from "@kulupay/core";

export interface TronClientProviderOptions {
    /** Recipient address (Base58 format, e.g. "T...") */
    recipientAddress: string;
    /** TRC-20 token contract address (optional — undefined = native TRX) */
    tokenContractAddress?: string;
    /** Token decimals (default 6 for TRX, 6 for USDT) */
    tokenDecimals?: number;
    /** Provider ID — should match the server-side provider ID */
    id?: string;
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
            throw new Error(
                "No Tron wallet found. Please install TronLink extension.",
            );
        }
        return tw;
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
                throw new Error(
                    "TronLink not connected. Please unlock TronLink and connect your account.",
                );
            }

            const fromAddress = tw.defaultAddress.base58;
            const intent = confirmOptions?.paymentMethodData as {
                to: string;
                amount: string;
                isNative: boolean;
                contractAddress?: string;
            };

            if (!intent) {
                throw new Error("Missing payment data for confirmation");
            }

            let txHash: string;

            if (intent.isNative || !intent.contractAddress) {
                // Native TRX transfer
                txHash = await tw.trx.sendTransaction(
                    options.recipientAddress,
                    parseInt(intent.amount),
                );
            } else {
                // TRC-20 transfer
                const contract = await tw
                    .contract()
                    .at(intent.contractAddress);
                txHash = await contract
                    .transfer(options.recipientAddress, parseInt(intent.amount))
                    .send();
            }

            const hashStr: string =
                typeof txHash === "string" ? txHash : (txHash as any)?.txID ?? "";

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
                throw new Error(`Failed to verify transaction: ${error.message}`);
            }
        },

        getSDK: async () => {
            return getTronWeb();
        },
    };
};
