import { describe, it, expect, vi, beforeEach } from "vitest";
import { tron, CHAINS, TOKENS } from "./index";
import type { CreateIntentData } from "../../types";

// Mock tronweb
const mockTronWebInstance = {
    trx: {
        getTransaction: vi.fn(),
        getTransactionsRelated: vi.fn(),
        sendTransaction: vi.fn(),
    },
    contract: vi.fn(() => ({
        at: vi.fn(() => ({
            Transfer: vi.fn(() => ({
                get: vi.fn(),
            })),
            transfer: vi.fn(() => ({
                send: vi.fn(),
            })),
        })),
    })),
    address: {
        fromHex: vi.fn((hex: string) => "T" + hex.slice(-33)),
    },
};

function TronWebMock(this: any) {
    return mockTronWebInstance;
}
TronWebMock.address = {
    fromHex: vi.fn((hex: string) => "T" + hex.slice(-33)),
};

vi.mock("tronweb", () => ({
    default: TronWebMock,
}));

const RECIPIENT = "TJmY7vLQgP3NvLx5oLQ4gQ8v2wR3nK9x5H";
const TX_HASH = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("tron provider — construction", () => {
    it("throws if chain family is not tron", () => {
        expect(() =>
            tron({
                chain: CHAINS.ethereum, // wrong family
                recipientAddress: RECIPIENT,
            }),
        ).toThrow();
    });

    it("defaults to native TRX when no token specified", () => {
        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });
        expect(provider.id).toBe("tron-tron");
    });

    it("uses custom provider id when provided", () => {
        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
            id: "tron-usdt",
        });
        expect(provider.id).toBe("tron-usdt");
    });
});

describe("tron provider — createIntent", () => {
    const provider = tron({
        chain: CHAINS.tron,
        recipientAddress: RECIPIENT,
    });

    const baseData: CreateIntentData = {
        amount: 1000000,
        currency: "usd",
        userId: "user_123",
        providerId: "tron-tron",
    };

    it("returns pending status", async () => {
        const intent = await provider.createIntent(baseData);
        expect(intent.status).toBe("pending");
    });

    it("generates a unique reference", async () => {
        const intent1 = await provider.createIntent(baseData);
        const intent2 = await provider.createIntent(baseData);
        expect(intent1.id).not.toBe(intent2.id);
    });

    it("uses reference from metadata if provided", async () => {
        const intent = await provider.createIntent({
            ...baseData,
            metadata: { reference: "custom_tron_ref" },
        });
        expect(intent.id).toBe("custom_tron_ref");
    });

    it("sets raw.to to recipient for native TRX", async () => {
        const intent = await provider.createIntent(baseData);
        expect((intent.raw as any).to).toBe(RECIPIENT);
        expect((intent.raw as any).isNative).toBe(true);
    });

    it("sets raw.to to recipient for TRC-20 (contract in separate field)", async () => {
        const trc20Provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
            token: {
                symbol: "USDT",
                decimals: 6,
                contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            },
        });
        const intent = await trc20Provider.createIntent(baseData);
        expect((intent.raw as any).to).toBe(RECIPIENT);
        expect((intent.raw as any).isNative).toBe(false);
        expect((intent.raw as any).contractAddress).toBe(
            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        );
    });

    it("includes blockchain metadata with tron family", async () => {
        const intent = await provider.createIntent(baseData);
        expect((intent.metadata as any).family).toBe("tron");
        expect((intent.metadata as any).chain).toBe("tron");
        expect((intent.metadata as any).recipient).toBe(RECIPIENT);
        expect((intent.metadata as any).token.symbol).toBe("TRX");
    });

    it("uses price converter when provided", async () => {
        const mockConverter = vi.fn().mockResolvedValue({
            cryptoAmount: "25000000",
            tokenSymbol: "USDT",
            rate: 1.0,
            rateTimestamp: new Date(),
        });

        const providerWithConverter = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
            token: {
                symbol: "USDT",
                decimals: 6,
                contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            },
            priceConverter: mockConverter,
        });

        const intent = await providerWithConverter.createIntent(baseData);
        expect(mockConverter).toHaveBeenCalledWith(
            1000000,
            "usd",
            expect.objectContaining({ symbol: "USDT" }),
            expect.objectContaining({ name: "tron" }),
        );
        expect((intent.metadata as any).priceConversion).toBeDefined();
        expect((intent.metadata as any).priceConversion.cryptoAmount).toBe(
            "25000000",
        );
    });
});

describe("tron provider — getIntent (tx hash)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns succeeded when contractRet is success", async () => {
        mockTronWebInstance.trx.getTransaction.mockResolvedValue({
            ret: [{ contractRet: "success" }],
        });

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("succeeded");
        expect((result.metadata as any).txHash).toBe(TX_HASH);
    });

    it("returns pending when contractRet is not success", async () => {
        mockTronWebInstance.trx.getTransaction.mockResolvedValue({
            ret: [{ contractRet: "pending" }],
        });

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("pending");
    });

    it("returns failed when tx has Error", async () => {
        mockTronWebInstance.trx.getTransaction.mockResolvedValue({
            Error: "transaction not found",
        });

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("failed");
    });

    it("returns pending when id is a reference (not a tx hash)", async () => {
        mockTronWebInstance.trx.getTransactionsRelated.mockResolvedValue([]);

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.getIntent("ref_123_abc");
        expect(result.status).toBe("pending");
    });

    it("wraps errors in ProviderError", async () => {
        mockTronWebInstance.trx.getTransaction.mockRejectedValue(
            new Error("TronGrid down"),
        );

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        await expect(provider.getIntent(TX_HASH)).rejects.toThrow(
            "TronGrid down",
        );
    });
});

describe("tron provider — cancelIntent", () => {
    it("returns canceled status", async () => {
        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.cancelIntent("ref_123");
        expect(result.status).toBe("canceled");
        expect(result.id).toBe("ref_123");
    });
});

describe("tron provider — refund", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws if TRON_REFUND_PRIVATE_KEY is not set", async () => {
        const originalKey = process.env.TRON_REFUND_PRIVATE_KEY;
        delete process.env.TRON_REFUND_PRIVATE_KEY;

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        await expect(provider.refund!(TX_HASH)).rejects.toThrow(
            "TRON_REFUND_PRIVATE_KEY",
        );

        process.env.TRON_REFUND_PRIVATE_KEY = originalKey;
    });

    it("throws if id is not a tx hash", async () => {
        process.env.TRON_REFUND_PRIVATE_KEY = "test_private_key_123";

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        await expect(provider.refund!("ref_123")).rejects.toThrow(
            "transaction hash",
        );
    });

    it("refunds native TRX to original sender", async () => {
        process.env.TRON_REFUND_PRIVATE_KEY = "test_private_key_123";

        mockTronWebInstance.trx.getTransaction.mockResolvedValue({
            raw_data: {
                contract: [
                    {
                        parameter: {
                            value: {
                                owner_address: "415a523b4d8607a0100000000",
                                amount: 1000000,
                            },
                        },
                    },
                ],
            },
        });
        mockTronWebInstance.trx.sendTransaction.mockResolvedValue("refund_tx_hash_123");

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        const result = await provider.refund!(TX_HASH);
        expect(result.status).toBe("succeeded");
        expect(mockTronWebInstance.trx.sendTransaction).toHaveBeenCalled();
    });

    it("throws if sender cannot be determined from tx", async () => {
        process.env.TRON_REFUND_PRIVATE_KEY = "test_private_key_123";

        mockTronWebInstance.trx.getTransaction.mockResolvedValue({
            raw_data: { contract: [{ parameter: { value: {} } }] },
        });

        const provider = tron({
            chain: CHAINS.tron,
            recipientAddress: RECIPIENT,
        });

        await expect(provider.refund!(TX_HASH)).rejects.toThrow("sender");
    });
});
