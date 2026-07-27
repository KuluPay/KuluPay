import type {
    PaymentClientProvider,
    PaymentIntent,
    PaymentConfirmOptions,
} from "@kulupay/core";

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
            throw new Error(
                "No EVM wallet found. Please install MetaMask or another EIP-1193 wallet.",
            );
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
                // Chain not added to wallet — try to add it
                if (switchError.code === 4902) {
                    throw new Error(
                        `Chain ${options.chainId} not found in wallet. Please add it first.`,
                    );
                }
                throw switchError;
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
                value: string;
                data?: string;
            };

            if (!intent) {
                throw new Error("Missing payment data for confirmation");
            }

            const isNative = !options.tokenContractAddress;

            let txHash: string;

            if (isNative) {
                // Native ETH transfer
                txHash = await eth.request({
                    method: "eth_sendTransaction",
                    params: [
                        {
                            from: fromAddress,
                            to: intent.to,
                            value: intent.value,
                            data: intent.data ?? "0x",
                        },
                    ],
                });
            } else {
                // ERC-20 transfer
                txHash = await eth.request({
                    method: "eth_sendTransaction",
                    params: [
                        {
                            from: fromAddress,
                            to: options.tokenContractAddress,
                            value: "0x0",
                            data: intent.data,
                        },
                    ],
                });
            }

            return {
                id: txHash,
                amount: 0,
                currency: "",
                status: "processing",
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
                throw new Error(`Failed to verify transaction: ${error.message}`);
            }
        },

        getSDK: async () => {
            return getEthereum();
        },
    };
};
