import { describe, it, expect } from "vitest";
import { validateCurrency, normalizeCurrency, SUPPORTED_CURRENCIES } from "./currency";

describe("Currency Utils", () => {
    describe("validateCurrency", () => {
        it("should accept valid 3-letter currency codes", () => {
            expect(validateCurrency("usd")).toBe(true);
            expect(validateCurrency("eur")).toBe(true);
            expect(validateCurrency("gbp")).toBe(true);
            expect(validateCurrency("jpy")).toBe(true);
        });

        it("should accept uppercase currency codes (normalizes internally)", () => {
            expect(validateCurrency("USD")).toBe(true);
            expect(validateCurrency("EUR")).toBe(true);
        });

        it("should accept currency codes with whitespace", () => {
            expect(validateCurrency("  usd  ")).toBe(true);
        });

        it("should reject codes that are not 3 letters", () => {
            expect(validateCurrency("us")).toBe(false);
            expect(validateCurrency("usdollar")).toBe(false);
            expect(validateCurrency("u")).toBe(false);
        });

        it("should reject codes with numbers or special characters", () => {
            expect(validateCurrency("us1")).toBe(false);
            expect(validateCurrency("u$d")).toBe(false);
            expect(validateCurrency("usd!")).toBe(false);
        });

        it("should reject empty or undefined", () => {
            expect(validateCurrency("")).toBe(false);
            expect(validateCurrency(undefined as any)).toBe(false);
            expect(validateCurrency(null as any)).toBe(false);
        });

        it("should check against supported list in strict mode", () => {
            expect(validateCurrency("usd", true)).toBe(true);
            expect(validateCurrency("etb", true)).toBe(true);
            expect(validateCurrency("ngn", true)).toBe(true);
            expect(validateCurrency("xxx", true)).toBe(false);
        });

        it("should accept any 3-letter code in non-strict mode", () => {
            expect(validateCurrency("xxx")).toBe(true);
            expect(validateCurrency("abc")).toBe(true);
        });
    });

    describe("normalizeCurrency", () => {
        it("should lowercase and trim", () => {
            expect(normalizeCurrency("USD")).toBe("usd");
            expect(normalizeCurrency("  EUR  ")).toBe("eur");
            expect(normalizeCurrency("Gbp")).toBe("gbp");
        });
    });

    describe("SUPPORTED_CURRENCIES", () => {
        it("should include major currencies", () => {
            expect(SUPPORTED_CURRENCIES).toContain("usd");
            expect(SUPPORTED_CURRENCIES).toContain("eur");
            expect(SUPPORTED_CURRENCIES).toContain("gbp");
            expect(SUPPORTED_CURRENCIES).toContain("jpy");
        });

        it("should include African currencies for Chapa", () => {
            expect(SUPPORTED_CURRENCIES).toContain("etb");
            expect(SUPPORTED_CURRENCIES).toContain("kes");
            expect(SUPPORTED_CURRENCIES).toContain("ngn");
            expect(SUPPORTED_CURRENCIES).toContain("ghs");
        });

        it("should all be 3-letter lowercase codes", () => {
            for (const code of SUPPORTED_CURRENCIES) {
                expect(code).toMatch(/^[a-z]{3}$/);
            }
        });
    });
});
