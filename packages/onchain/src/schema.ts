/**
 * Database schema extensions for the onchain plugin.
 * These fields are added to the paymentIntent table.
 */
export const onchainSchema = {
    paymentIntent: {
        fields: {
            chainId: {
                type: "number" as const,
                required: false,
            },
            txHash: {
                type: "string" as const,
                required: false,
            },
            blockNumber: {
                type: "number" as const,
                required: false,
            },
            confirmations: {
                type: "number" as const,
                required: false,
            },
        },
    },
};
