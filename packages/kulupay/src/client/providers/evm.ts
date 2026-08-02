import type {
    PaymentClientProvider,
    PaymentIntent,
    PaymentConfirmOptions,
} from "@kulupay/core";
import { BlockchainError, type NetworkInfo } from "@kulupay/core/payment-providers/blockchain";

export interface EVMClientProviderOptions {
    /** Chain ID (e.g. 1 for Ethereum, 137 for Polygon, 8453 for Base) */
    chainId: number;
    /** Recipient address (0x...) */
    recipientAddress: `0x${string}`;
    /** ERC-20 token contract address (optional — undefined = native ETH) */
    tokenContractAddress?: `0x${string}`;
    /** Token decimals (default 18 for ETH, 6 for USDC/USDT) */
    tokenDecimals?: number;
    /** Provider ID — should match the server-side provider ID */
    id?: string;
    /** Network info for context-aware error messages */
    network?: NetworkInfo;
}

/**
 * EVM client provider — connects to the user's wallet via window.ethereum
 * (MetaMask, Coinbase Wallet, etc.) and confirms blockchain payments.
 *
 * No wagmi dependency required — uses window.ethereum directly.
 * This keeps the client bundle small and works with any EIP-1193 wallet.
 *
 * For React apps, you can wrap this with wagmi hooks for better UX
 * (connection state, auto-reconnect, multi-wallet support).
 */
export const createEVMClientProvider = (
    options: EVMClientProviderOptions,
): PaymentClientProvider => {
    const providerId = options.id ?? `evm-${options.chainId}`;

    const getEthereum = (): any => {
        if (typeof globalThis === "undefined") return null;
        const eth = (globalThis as any).ethereum;
        if (!eth) {
            throw new BlockchainError("WALLET_NOT_FOUND");
        }
        return eth;
    };

    const ensureChain = async (eth: any): Promise<string> => {
        const chainIdHex = `0x${options.chainId.toString(16)}`;
        const currentChain = await eth.request({ method: "eth_chainId" });

        if (currentChain !== chainIdHex) {
            try {
                await eth.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: chainIdHex }],
                });
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    throw new BlockchainError("CHAIN_NOT_ADDED", { chainId: options.chainId, details: switchError.message }, switchError);
                }
                throw BlockchainError.fromWalletError(switchError);
            }
        }

        const accounts = await eth.request({
            method: "eth_requestAccounts",
        });
        return accounts[0] as string;
    };

    return {
        id: providerId,

        confirmPayment: async (
            clientSecret: string,
            confirmOptions?: PaymentConfirmOptions,
        ): Promise<PaymentIntent> => {
            const eth = getEthereum();
            const fromAddress = await ensureChain(eth);

            // Parse the intent data from clientSecret
            // clientSecret format: "reference:txData" or just the reference
            // The actual payment data comes from the server's createIntent response
            const intent = confirmOptions?.paymentMethodData as {
                to: string;
                value?: string;
                data?: string;
                isNative?: boolean;
            };

            if (!intent) {
                throw new BlockchainError("MISSING_PAYMENT_DATA");
            }

            // Determine native vs ERC-20
            // Use isNative flag from server if available, otherwise infer from value/data
            const isNative = intent.isNative ?? (intent.value && intent.value !== "0" && intent.value !== "0x0" && (!intent.data || intent.data === "0x"));

            let txHash: string;

            try {
                if (isNative) {
                    // Native ETH transfer — value must be hex-encoded
                    const hexValue = "0x" + BigInt(intent.value ?? "0").toString(16);
                    console.log("[KuluPay:EVM] Sending native:", {
                        from: fromAddress,
                        to: intent.to,
                        value: hexValue,
                    });
                    txHash = await eth.request({
                        method: "eth_sendTransaction",
                        params: [
                            {
                                from: fromAddress,
                                to: intent.to,
                                value: hexValue,
                                data: intent.data ?? "0x",
                            },
                        ],
                    });
                } else {
                    // ERC-20 transfer — to is the contract address, data contains the transfer call
                    console.log("[KuluPay:EVM] Sending ERC-20:", {
                        from: fromAddress,
                        to: intent.to,
                        data: intent.data,
                    });
                    txHash = await eth.request({
                        method: "eth_sendTransaction",
                        params: [
                            {
                                from: fromAddress,
                                to: intent.to,
                                value: "0x0",
                                data: intent.data,
                            },
                        ],
                    });
                }
                console.log("[KuluPay:EVM] Transaction result:", txHash);
            } catch (txError: any) {
                console.error("[KuluPay:EVM] Transaction error:", {
                    message: txError?.message,
                    code: txError?.code,
                    data: txError?.data,
                    reason: txError?.reason,
                    error: txError?.error?.message,
                    string: String(txError),
                    json: (() => { try { return JSON.stringify(txError, Object.getOwnPropertyNames(txError)); } catch { return undefined; } })(),
                });
                throw BlockchainError.fromWalletError(txError, options.network);
            }

            return {
                id: confirmOptions?.intentId ?? txHash,
                amount: 0,
                currency: "",
                status: "pending_confirmation",
                metadata: {
                    txHash,
                    from: fromAddress,
                    chainId: options.chainId,
                },
                raw: { txHash },
            };
        },

        verifyPayment: async (clientSecret: string): Promise<PaymentIntent> => {
            const eth = getEthereum();
            const txHash = clientSecret;

            try {
                const receipt = await eth.request({
                    method: "eth_getTransactionReceipt",
                    params: [txHash],
                });

                if (!receipt) {
                    return {
                        id: txHash,
                        amount: 0,
                        currency: "",
                        status: "pending",
                        metadata: { txHash },
                        raw: null,
                    };
                }

                const success = parseInt(receipt.status, 16) === 1;

                return {
                    id: txHash,
                    amount: 0,
                    currency: "",
                    status: success ? "succeeded" : "failed",
                    metadata: {
                        txHash,
                        blockNumber: parseInt(receipt.blockNumber, 16),
                        gasUsed: parseInt(receipt.gasUsed, 16),
                    },
                    raw: receipt,
                };
            } catch (error: any) {
                throw new BlockchainError("RPC_ERROR", { details: error.message }, error);
            }
        },

        getSDK: async () => {
            return getEthereum();
        },
    };
};
