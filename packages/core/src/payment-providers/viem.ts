import { 
    PaymentProvider, 
    PaymentIntent, 
    CreateIntentData, 
} from "../types";

import { ProviderError } from "../error";

export interface ViemOptions {
    chain: any;
    rpcUrl?: string;
    recipientAddress: `0x${string}`;
}

export const viem = (options: ViemOptions) => {
    return {
        id: "viem",
        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            const reference = data.metadata?.reference || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            
            return {
                id: reference,
                amount: data.amount,
                currency: data.currency,
                status: "pending",
                metadata: {
                    ...data.metadata,
                    recipient: options.recipientAddress,
                    reference: reference
                },
                raw: {
                    to: options.recipientAddress,
                    value: data.amount,
                    data: "0x",
                }
            };
        },
        getIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const { createPublicClient, http } = await import("viem");
                const client = createPublicClient({
                    chain: options.chain,
                    transport: http(options.rpcUrl),
                });

                if (id.startsWith("0x") && id.length === 66) {
                    const receipt = await client.getTransactionReceipt({ hash: id as `0x${string}` });
                    return {
                        id: id,
                        amount: 0,
                        currency: "ETH",
                        status: receipt.status === "success" ? "succeeded" : "failed",
                        raw: receipt
                    };
                }
                throw new ProviderError("Invalid transaction hash for viem provider", "viem");
            } catch (error: any) {
                throw new ProviderError(error.message, "viem");
            }
        },
        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            throw new ProviderError("Cancellation not supported on-chain via SDK", "viem");
        }
    } satisfies PaymentProvider;
};
