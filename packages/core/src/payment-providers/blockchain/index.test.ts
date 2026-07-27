import { describe, it, expect } from "vitest";
import { CHAINS, TOKENS } from "./index";

describe("CHAINS presets", () => {
    it("has ethereum with correct values", () => {
        expect(CHAINS.ethereum.family).toBe("evm");
        expect(CHAINS.ethereum.chainId).toBe(1);
        expect(CHAINS.ethereum.rpcUrl).toContain("eth");
    });

    it("has polygon with correct values", () => {
        expect(CHAINS.polygon.family).toBe("evm");
        expect(CHAINS.polygon.chainId).toBe(137);
    });

    it("has base with correct values", () => {
        expect(CHAINS.base.family).toBe("evm");
        expect(CHAINS.base.chainId).toBe(8453);
    });

    it("has arbitrum with correct values", () => {
        expect(CHAINS.arbitrum.family).toBe("evm");
        expect(CHAINS.arbitrum.chainId).toBe(42161);
    });

    it("has tron with correct values", () => {
        expect(CHAINS.tron.family).toBe("tron");
        expect(CHAINS.tron.chainId).toBe(728126428);
        expect(CHAINS.tron.rpcUrl).toContain("trongrid");
    });

    it("all chains have rpcUrl and name", () => {
        for (const chain of Object.values(CHAINS)) {
            expect(chain.rpcUrl).toBeDefined();
            expect(chain.name).toBeDefined();
            expect(chain.explorerUrl).toBeDefined();
        }
    });
});

describe("TOKENS presets", () => {
    it("ETH is native with 18 decimals", () => {
        expect(TOKENS.ETH.symbol).toBe("ETH");
        expect(TOKENS.ETH.decimals).toBe(18);
        expect(TOKENS.ETH.contractAddress).toBeUndefined();
    });

    it("MATIC is native with 18 decimals", () => {
        expect(TOKENS.MATIC.symbol).toBe("MATIC");
        expect(TOKENS.MATIC.decimals).toBe(18);
    });

    it("TRX is native with 6 decimals", () => {
        expect(TOKENS.TRX.symbol).toBe("TRX");
        expect(TOKENS.TRX.decimals).toBe(6);
    });

    it("USDC creates token config with contract address", () => {
        const usdc = TOKENS.USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        expect(usdc.symbol).toBe("USDC");
        expect(usdc.decimals).toBe(6);
        expect(usdc.contractAddress).toBe(
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        );
    });

    it("USDT creates token config with contract address", () => {
        const usdt = TOKENS.USDT("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
        expect(usdt.symbol).toBe("USDT");
        expect(usdt.decimals).toBe(6);
        expect(usdt.contractAddress).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    });

    it("DAI creates token config with 18 decimals", () => {
        const dai = TOKENS.DAI("0x6B175474E89094C44Da98b954EedeAC495271d0F");
        expect(dai.symbol).toBe("DAI");
        expect(dai.decimals).toBe(18);
    });
});
