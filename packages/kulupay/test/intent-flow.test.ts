import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTestInstance, createTestRequest, testUser } from "@kulupay/core/test-utils";
import type { KuluPayContext } from "@kulupay/core";
import type { PaymentProvider, PaymentIntent, ProviderChainConfig } from "@kulupay/core";

// Mock viem so the EVM provider doesn't need a real RPC
vi.mock("viem", () => ({
    createPublicClient: vi.fn(() => ({
        getTransactionReceipt: vi.fn(),
        getLogs: vi.fn(),
        getTransaction: vi.fn(),
    })),
    createWalletClient: vi.fn(() => ({
        sendTransaction: vi.fn(),
    })),
    http: vi.fn(() => ({}) as any),
    parseEther: vi.fn((v: string) => BigInt(v) * 10n ** 18n),
    parseUnits: vi.fn((v: string, d: number) => BigInt(v) * 10n ** BigInt(d)),
    parseAbiItem: vi.fn((s: string) => s as any),
}));

vi.mock("viem/accounts", () => ({
    privateKeyToAccount: vi.fn(() => ({
        address: "0xRefundAccount",
    })),
}));

const RECIPIENT = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bE11" as `0x${string}`;
const TX_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

/**
 * Creates a mock onchain provider that mimics the EVM provider
 * but with deterministic responses for testing the intent flow.
 */
function createMockEVMProvider(): PaymentProvider {
    const chainConfig: ProviderChainConfig = {
        family: "evm",
        chainId: 1,
        name: "ethereum",
        rpcUrl: "https://eth.llamarpc.com",
        explorerUrl: "https://etherscan.io",
        tokens: {
            native: { symbol: "ETH", decimals: 18 },
            USDC: { symbol: "USDC", decimals: 6, contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
        },
    };

    return {
        id: "ethereum",
        checkout: "self-hosted",
        chainConfig,
        createIntent: vi.fn(async (data) => ({
            id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            amount: data.amount,
            currency: data.currency,
            status: "pending" as const,
            clientSecret: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            metadata: {
                family: "evm",
                chain: "ethereum",
                recipient: RECIPIENT,
                token: { symbol: "ETH", decimals: 18 },
            },
            raw: {
                to: RECIPIENT,
                value: data.amount.toString(),
                data: "0x",
                chainId: 1,
                tokenSymbol: "ETH",
                isNative: true,
            },
        }) as any),
        getIntent: vi.fn(async (id: string) => {
            if (id.startsWith("0x") && id.length > 20) {
                return {
                    id,
                    amount: 1000000,
                    currency: "usd",
                    status: "succeeded" as const,
                    clientSecret: id,
                    metadata: {
                        family: "evm",
                        chain: "ethereum",
                        txHash: id,
                        confirmations: 12,
                        requiredConfirmations: 3,
                    },
                    raw: null,
                } as any;
            }
            return {
                id,
                amount: 1000000,
                currency: "usd",
                status: "pending" as const,
                clientSecret: id,
                metadata: { family: "evm", chain: "ethereum" },
                raw: null,
            } as any;
        }),
        cancelIntent: vi.fn(async (id: string) => ({
            id,
            status: "canceled" as const,
        }) as any),
        confirmIntent: vi.fn(async (id: string, txHash: string) => ({
            id,
            status: "pending_confirmation" as const,
            txHash,
        }) as any),
        refund: vi.fn(async () => ({
            id: "refund_123",
            status: "succeeded" as const,
        }) as any),
        createCustomer: vi.fn(async (data) => ({
            id: `cust_${data.userId}`,
            userId: data.userId,
            providerId: data.providerId,
            providerCustomerId: `cust_${data.userId}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }) as any),
    } as any;
}

async function callEndpoint(
    ctx: KuluPayContext,
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {},
) {
    const { router } = await import("../src/api");
    const r = router(ctx);
    const req = createTestRequest(path, {
        ...options,
        origin: "http://localhost:3000",
    });
    const response = await r.handler(req);
    const json = await response.json();
    return { response, json };
}

describe("intent flow — createIntent → confirmIntent → verifyIntent", () => {
    let ctx: KuluPayContext;
    let mockProvider: PaymentProvider;

    beforeEach(async () => {
        mockProvider = createMockEVMProvider();
        const result = await getTestInstance({
            providers: {
                ethereum: {
                    recipientAddress: RECIPIENT,
                    tokens: ["USDC"],
                },
            },
        } as any);

        // Override the providers map with our mock
        ctx = result.ctx;
        (ctx as any).providers = new Map([["ethereum", mockProvider]]);
    });

    it("createIntent returns pending status with chainConfig", async () => {
        const { response, json } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        expect(response.status).toBe(200);
        expect(json.status).toBe("pending");
        expect(json.id).toBeDefined();
        expect(json.clientSecret).toBeDefined();
        expect(json.chainConfig).toBeDefined();
        expect(json.chainConfig.family).toBe("evm");
        expect(json.chainConfig.chainId).toBe(1);
        expect(json.chainConfig.name).toBe("ethereum");
        expect(json.chainConfig.tokens).toBeDefined();
        expect(Object.keys(json.chainConfig.tokens).length).toBeGreaterThan(0);
        expect(json.raw).toBeDefined();
        expect(json.raw.to).toBe(RECIPIENT);
    });

    it("createIntent rejects unauthenticated requests", async () => {
        const { response, json } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "none" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        expect(response.status).toBe(401);
        expect(json.error).toBeDefined();
    });

    it("createIntent rejects invalid currency", async () => {
        const { response, json } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "notacurrency",
                providerId: "ethereum",
            },
        });

        expect(response.status).toBe(400);
        expect(json.error).toBeDefined();
    });

    it("createIntent rejects unknown provider", async () => {
        const { response, json } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "nonexistent",
            },
        });

        expect(response.status).toBe(404);
        expect(json.error).toBeDefined();
    });

    it("confirmIntent accepts txHash and returns pending_confirmation", async () => {
        // First create an intent
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        expect(created.id).toBeDefined();
        expect(created.clientSecret).toBeDefined();

        // Now confirm it
        const { response, json } = await callEndpoint(ctx, "/confirm-intent", {
            method: "POST",
            body: {
                intentId: created.id,
                txHash: TX_HASH,
                clientSecret: created.clientSecret,
            },
        });

        expect(response.status).toBe(200);
        expect(json.status).toBe("pending_confirmation");
        expect(json.txHash).toBe(TX_HASH);
    });

    it("confirmIntent rejects wrong clientSecret", async () => {
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        const { response, json } = await callEndpoint(ctx, "/confirm-intent", {
            method: "POST",
            body: {
                intentId: created.id,
                txHash: TX_HASH,
                clientSecret: "wrong_secret",
            },
        });

        expect(response.status).toBe(403);
        expect(json.error).toBeDefined();
    });

    it("confirmIntent rejects missing fields", async () => {
        const { response, json } = await callEndpoint(ctx, "/confirm-intent", {
            method: "POST",
            body: {
                intentId: "some_id",
                // missing txHash and clientSecret
            },
        });

        expect(response.status).toBe(400);
        expect(json.error).toBeDefined();
    });

    it("verifyIntent returns pending for unconfirmed intent", async () => {
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        // verifyIntent uses query params, not body — need to pass via URL
        const req = createTestRequest(`/verify-intent?intentId=${created.id}&clientSecret=${created.clientSecret}`, { origin: "http://localhost:3000" });
        const { router } = await import("../src/api");
        const r = router(ctx);
        const res = await r.handler(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.status).toBe("pending");
        expect(data.txHash).toBeNull();
    });

    it("verifyIntent returns succeeded after onchain confirmation", async () => {
        // Create intent
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        // Confirm with txHash
        await callEndpoint(ctx, "/confirm-intent", {
            method: "POST",
            body: {
                intentId: created.id,
                txHash: TX_HASH,
                clientSecret: created.clientSecret,
            },
        });

        // Mock provider's getIntent to return succeeded for this txHash
        (mockProvider.getIntent as any).mockResolvedValue({
            id: created.id,
            amount: 1000000,
            currency: "usd",
            status: "succeeded",
            clientSecret: created.clientSecret,
            metadata: {
                family: "evm",
                chain: "ethereum",
                txHash: TX_HASH,
                confirmations: 12,
                requiredConfirmations: 3,
            },
            raw: null,
        });

        // Verify — should now return succeeded
        const { router } = await import("../src/api");
        const r = router(ctx);
        const req = createTestRequest(`/verify-intent?intentId=${created.id}&clientSecret=${created.clientSecret}`, { origin: "http://localhost:3000" });
        const res = await r.handler(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.status).toBe("succeeded");
        expect(data.txHash).toBe(TX_HASH);
    });

    it("verifyIntent rejects wrong clientSecret", async () => {
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        const { router } = await import("../src/api");
        const r = router(ctx);
        const req = createTestRequest(`/verify-intent?intentId=${created.id}&clientSecret=wrong_secret`, { origin: "http://localhost:3000" });
        const res = await r.handler(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toBeDefined();
    });

    it("checkoutIntent returns full payment data for checkout rendering", async () => {
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 1000000,
                currency: "usd",
                providerId: "ethereum",
            },
        });

        const { router } = await import("../src/api");
        const r = router(ctx);
        const req = createTestRequest(`/checkout-intent?intentId=${created.id}&clientSecret=${created.clientSecret}`, { origin: "http://localhost:3000" });
        const res = await r.handler(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.id).toBe(created.id);
        expect(data.amount).toBe(1000000);
        expect(data.currency).toBe("usd");
        expect(data.status).toBe("pending");
        expect(data.providerId).toBe("ethereum");
        expect(data.checkoutFlow).toBe("self-hosted");
        expect(data.raw).toBeDefined();
        expect(data.metadata.family).toBe("evm");
    });

    it("full flow: create → confirm → verify → checkout", async () => {
        // 1. Create
        const { json: created } = await callEndpoint(ctx, "/create-intent", {
            method: "POST",
            headers: { "x-test-role": "user" },
            body: {
                amount: 500000,
                currency: "usd",
                providerId: "ethereum",
            },
        });
        expect(created.status).toBe("pending");
        expect(created.chainConfig).toBeDefined();

        // 2. Confirm
        const { json: confirmed } = await callEndpoint(ctx, "/confirm-intent", {
            method: "POST",
            body: {
                intentId: created.id,
                txHash: TX_HASH,
                clientSecret: created.clientSecret,
            },
        });
        expect(confirmed.status).toBe("pending_confirmation");

        // 3. Mock onchain confirmation
        (mockProvider.getIntent as any).mockResolvedValue({
            id: created.id,
            amount: 500000,
            currency: "usd",
            status: "succeeded",
            clientSecret: created.clientSecret,
            metadata: { family: "evm", chain: "ethereum", txHash: TX_HASH },
            raw: null,
        });

        // 4. Verify
        const { router } = await import("../src/api");
        const r = router(ctx);
        const verifyReq = createTestRequest(`/verify-intent?intentId=${created.id}&clientSecret=${created.clientSecret}`, { origin: "http://localhost:3000" });
        const verifyRes = await r.handler(verifyReq);
        const verified = await verifyRes.json();
        expect(verified.status).toBe("succeeded");

        // 5. Checkout should also reflect succeeded
        const checkoutReq = createTestRequest(`/checkout-intent?intentId=${created.id}&clientSecret=${created.clientSecret}`, { origin: "http://localhost:3000" });
        const checkoutRes = await r.handler(checkoutReq);
        const checkout = await checkoutRes.json();
        expect(checkout.status).toBe("succeeded");
    });
});
