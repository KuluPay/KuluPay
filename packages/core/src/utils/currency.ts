/**
 * ISO 4217 currency codes supported by major payment providers.
 * This is the intersection of currencies supported by Stripe, Chapa, and PayPal.
 * Not exhaustive — providers may support more. Use validateCurrency() to check.
 */
export const SUPPORTED_CURRENCIES = [
    "usd", "eur", "gbp", "jpy", "aud", "cad", "chf", "cny", "sek", "nok",
    "dkk", "sgd", "hkd", "nzd", "inr", "brl", "mxn", "zar", "aed", "sar",
    "etb", // Ethiopian Birr — Chapa
    "kes", // Kenyan Shilling
    "ngn", // Nigerian Naira
    "ghs", // Ghanaian Cedi
    "rwf", // Rwandan Franc
    "ugx", // Ugandan Shilling
    "tzs", // Tanzanian Shilling
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * Validates that a currency code is a 3-letter ISO 4217 code.
 * If `strict` is true, checks against the SUPPORTED_CURRENCIES list.
 * If `strict` is false (default), just checks the format (3 lowercase letters).
 */
export function validateCurrency(
    currency: string,
    strict: boolean = false,
): boolean {
    if (!currency || typeof currency !== "string") return false;

    const normalized = currency.toLowerCase().trim();

    // ISO 4217: exactly 3 letters
    if (!/^[a-z]{3}$/.test(normalized)) return false;

    if (strict) {
        return (SUPPORTED_CURRENCIES as readonly string[]).includes(normalized);
    }

    return true;
}

/**
 * Normalizes a currency code to lowercase (ISO 4217 standard).
 */
export function normalizeCurrency(currency: string): string {
    return currency.toLowerCase().trim();
}
