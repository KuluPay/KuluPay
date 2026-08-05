import { describe, it, expect, vi, beforeEach } from "vitest";
import { evm, CHAINS, TOKENS } from "./index";
import type { CreateIntentData } from "../../types";

// Mock viem
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

const { createPublicClient, createWalletClient } = await import("viem");
const { privateKeyToAccount } = await import("viem/accounts");

const RECIPIENT = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bE11" as `0x${string}`;
const TX_HASH =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

describe("evm provider — construction", () => {
    it("throws if chain family is not evm", () => {
        expect(() =>
            evm({
                chain: CHAINS.tron, // wrong family
                recipientAddress: RECIPIENT,
                tokens: { native: { symbol: "TRX", decimals: 6 } },
            }),
        ).toThrow();
    });

    it("defaults provider id to chain name", () => {
        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });
        expect(provider.id).toBe("ethereum");
    });

    it("uses custom provider id when provided", () => {
        const provider = evm({
            chain: CHAINS.base,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH, USDC: TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
            id: "base",
        });
        expect(provider.id).toBe("base");
    });

    it("defaults provider id to chain name for polygon", () => {
        const provider = evm({
            chain: CHAINS.polygon,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.MATIC },
        });
        expect(provider.id).toBe("polygon");
    });
});

describe("evm provider — createIntent", () => {
    const provider = evm({
        chain: CHAINS.ethereum,
        recipientAddress: RECIPIENT,
        tokens: { native: TOKENS.ETH },
    });

    const baseData: CreateIntentData = {
        amount: 1000000,
        currency: "usd",
        userId: "user_123",
        providerId: "ethereum",
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
            metadata: { reference: "custom_ref_123" },
        });
        expect(intent.id).toBe("custom_ref_123");
    });

    it("sets raw.to to recipient for native ETH", async () => {
        const intent = await provider.createIntent(baseData);
        expect((intent.raw as any).to).toBe(RECIPIENT);
        expect((intent.raw as any).isNative).toBe(true);
    });

    it("sets raw.to to token contract for ERC-20", async () => {
        const erc20Provider = evm({
            chain: CHAINS.base,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH, USDC: TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
        });
        const intent = await erc20Provider.createIntent({ ...baseData, token: "USDC", providerId: "base" });
        expect((intent.raw as any).to).toBe(
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        );
        expect((intent.raw as any).isNative).toBe(false);
        expect((intent.raw as any).value).toBe("0");
    });

    it("encodes ERC-20 transfer data with correct selector", async () => {
        const erc20Provider = evm({
            chain: CHAINS.base,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH, USDC: TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
        });
        const intent = await erc20Provider.createIntent({ ...baseData, token: "USDC", providerId: "base" });
        const data = (intent.raw as any).data as string;
        // transfer(address,uint256) selector = 0xa9059cbb
        expect(data.startsWith("0xa9059cbb")).toBe(true);
        // Total length: selector(10) + address(64) + amount(64) = 138 chars
        expect(data.length).toBe(138);
    });

    it("sets raw.value for native ETH transfer", async () => {
        const intent = await provider.createIntent(baseData);
        expect((intent.raw as any).value).toBe("1000000");
    });

    it("includes onchain metadata", async () => {
        const intent = await provider.createIntent(baseData);
        expect((intent.metadata as any).family).toBe("evm");
        expect((intent.metadata as any).chain).toBe("ethereum");
        expect((intent.metadata as any).recipient).toBe(RECIPIENT);
        expect((intent.metadata as any).token.symbol).toBe("ETH");
    });

    it("uses price converter when provided", async () => {
        const mockConverter = vi.fn().mockResolvedValue({
            cryptoAmount: "25000000",
            tokenSymbol: "USDC",
            rate: 1.0,
            rateTimestamp: new Date(),
        });

        const providerWithConverter = evm({
            chain: CHAINS.base,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH, USDC: TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
            priceConverter: mockConverter,
        });

        const intent = await providerWithConverter.createIntent({ ...baseData, token: "USDC", providerId: "base" });
        expect(mockConverter).toHaveBeenCalledWith(
            1000000,
            "usd",
            expect.objectContaining({ symbol: "USDC" }),
            expect.objectContaining({ name: "base" }),
        );
        expect((intent.metadata as any).priceConversion).toBeDefined();
        expect((intent.metadata as any).priceConversion.cryptoAmount).toBe(
            "25000000",
        );
    });
});

describe("evm provider — getIntent (tx hash)", () => {
    let mockGetTransactionReceipt: ReturnType<typeof vi.fn>;
    let mockGetLogs: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetTransactionReceipt = vi.fn();
        mockGetLogs = vi.fn();
        (createPublicClient as any).mockReturnValue({
            getTransactionReceipt: mockGetTransactionReceipt,
            getLogs: mockGetLogs,
            getTransaction: vi.fn(),
        });
    });

    it("returns succeeded when receipt status is success", async () => {
        mockGetTransactionReceipt.mockResolvedValue({
            status: "success",
            confirmations: 1n,
        });

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("succeeded");
        expect((result.metadata as any).txHash).toBe(TX_HASH);
    });

    it("returns failed when receipt status is reverted", async () => {
        mockGetTransactionReceipt.mockResolvedValue({
            status: "reverted",
            confirmations: 1n,
        });

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("failed");
    });

    it("returns failed when confirmations are insufficient", async () => {
        mockGetTransactionReceipt.mockResolvedValue({
            status: "success",
            confirmations: 0n,
        });

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
            confirmations: 3,
        });

        const result = await provider.getIntent(TX_HASH);
        expect(result.status).toBe("failed");
    });

    it("returns pending when id is a reference (not a tx hash)", async () => {
        mockGetLogs.mockResolvedValue([]);

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        const result = await provider.getIntent("ref_123_abc");
        expect(result.status).toBe("pending");
    });

    it("wraps errors in ProviderError", async () => {
        mockGetTransactionReceipt.mockRejectedValue(new Error("RPC down"));

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        await expect(provider.getIntent(TX_HASH)).rejects.toThrow("RPC down");
    });
});

describe("evm provider — cancelIntent", () => {
    it("returns canceled status", async () => {
        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        const result = await provider.cancelIntent("ref_123");
        expect(result.status).toBe("canceled");
        expect(result.id).toBe("ref_123");
    });
});

describe("evm provider — refund", () => {
    let mockSendTransaction: ReturnType<typeof vi.fn>;
    let mockGetTransaction: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSendTransaction = vi.fn();
        mockGetTransaction = vi.fn();
        (createWalletClient as any).mockReturnValue({
            sendTransaction: mockSendTransaction,
        });
        (createPublicClient as any).mockReturnValue({
            getTransactionReceipt: vi.fn(),
            getLogs: vi.fn(),
            getTransaction: mockGetTransaction,
        });
    });

    it("throws if EVM_REFUND_PRIVATE_KEY is not set", async () => {
        const originalKey = process.env.EVM_REFUND_PRIVATE_KEY;
        delete process.env.EVM_REFUND_PRIVATE_KEY;

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        await expect(provider.refund(TX_HASH)).rejects.toThrow(
            "EVM_REFUND_PRIVATE_KEY",
        );

        process.env.EVM_REFUND_PRIVATE_KEY = originalKey;
    });

    it("throws if id is not a tx hash", async () => {
        process.env.EVM_REFUND_PRIVATE_KEY =
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        await expect(provider.refund("ref_123")).rejects.toThrow(
            "transaction hash",
        );
    });

    it("refunds native ETH to original sender", async () => {
        process.env.EVM_REFUND_PRIVATE_KEY =
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

        mockGetTransaction.mockResolvedValue({
            from: "0xSender123",
            value: 1000000n,
            data: "0x",
        });
        mockSendTransaction.mockResolvedValue("0xRefundTxHash");

        const provider = evm({
            chain: CHAINS.ethereum,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH },
        });

        const result = await provider.refund(TX_HASH);
        expect(result.status).toBe("succeeded");
        expect(mockSendTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "0xSender123",
                value: 1000000n,
            }),
        );
    });

    it("refunds ERC-20 tokens to original sender", async () => {
        process.env.EVM_REFUND_PRIVATE_KEY =
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

        mockGetTransaction.mockResolvedValue({
            from: "0xSender123",
            value: 0n,
            data: "0xa9059cbb...",
            to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        });
        mockSendTransaction.mockResolvedValue("0xRefundTxHash");

        const provider = evm({
            chain: CHAINS.base,
            recipientAddress: RECIPIENT,
            tokens: { native: TOKENS.ETH, USDC: TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
        });

        const result = await provider.refund(TX_HASH, 500000);
        expect(result.status).toBe("succeeded");
        expect(mockSendTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                data: expect.stringContaining("0xa9059cbb"),
            }),
        );
    });
});
