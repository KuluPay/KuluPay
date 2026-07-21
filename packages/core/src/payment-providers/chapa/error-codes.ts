import { defineErrorCodes } from "../../utils/error-codes";

export const CHAPA_ERROR_CODES = defineErrorCodes({
	CHAPA_API_ERROR: "Chapa API returned an error",
	CHAPA_INITIALIZATION_FAILED: "Failed to initialize Chapa transaction",
	CHAPA_TRANSACTION_NOT_FOUND: "Chapa transaction not found",
	CHAPA_VERIFICATION_FAILED: "Chapa transaction verification failed",
	CHAPA_WEBHOOK_INVALID: "Invalid Chapa webhook payload",
	CHAPA_WEBHOOK_SECRET_MISSING: "Chapa webhook secret is not configured",
	CHAPA_WEBHOOK_SIGNATURE_INVALID: "Chapa webhook signature verification failed",
	CHAPA_CUSTOMER_CREATION_FAILED: "Failed to create Chapa customer",
	CHAPA_CUSTOMER_RETRIEVAL_FAILED: "Failed to retrieve Chapa customer",
	CHAPA_REFUND_NOT_SUPPORTED: "Chapa does not support refunds via API",
	CHAPA_SUBSCRIPTION_NOT_SUPPORTED: "Chapa does not support subscriptions",
});

export type ChapaErrorCode = keyof typeof CHAPA_ERROR_CODES;
