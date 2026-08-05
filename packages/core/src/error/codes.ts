import { defineErrorCodes } from "../utils/error-codes";

export const KULUPAY_ERROR_CODES = defineErrorCodes({
	// Auth
	UNAUTHORIZED: "Unauthorized access",
	FORBIDDEN: "You don't have permission to perform this action",
	INVALID_ORIGIN: "Invalid origin",
	MISSING_OR_NULL_ORIGIN: "Missing or null Origin",

	// Provider
	PROVIDER_NOT_FOUND: "Payment provider not found",
	PROVIDER_NOT_CONFIGURED: "Payment provider is not configured",
	PROVIDER_SDK_NOT_FOUND: "Provider SDK not installed",
	PROVIDER_ERROR: "Payment provider returned an error",
	PROVIDER_METHOD_NOT_SUPPORTED: "Payment provider does not support this operation",

	// Pricing
	PRICING_RESOLVE_FAILED: "Failed to resolve price from pricing resolver",
	PRICING_PRODUCT_NOT_FOUND: "Product not found in pricing resolver",
	PRICING_AMOUNT_MUST_BE_POSITIVE: "Resolved price amount must be greater than zero",
	PRICING_CURRENCY_REQUIRED: "Resolved price must include a valid currency code",
	PRICING_RESOLVER_NOT_CONFIGURED: "Pricing resolver is not configured but was required",

	// Payment
	PAYMENT_NOT_FOUND: "Payment not found",
	PAYMENT_ALREADY_SUCCEEDED: "Payment has already succeeded",
	PAYMENT_ALREADY_CANCELED: "Payment has already been canceled",
	PAYMENT_CANNOT_BE_CANCELED: "Payment cannot be canceled in its current state",
	INVALID_AMOUNT: "Invalid payment amount",
	INVALID_CURRENCY: "Invalid currency code",

	// Subscription
	SUBSCRIPTION_NOT_FOUND: "Subscription not found",
	SUBSCRIPTION_ALREADY_ACTIVE: "Subscription is already active",
	SUBSCRIPTION_NOT_CANCELLABLE: "Subscription cannot be canceled",
	SUBSCRIPTION_NOT_ACTIVE: "Subscription is not active",

	// Customer
	CUSTOMER_NOT_FOUND: "Customer not found",
	CUSTOMER_ALREADY_EXISTS: "Customer already exists",

	// Webhook
	WEBHOOK_SIGNATURE_INVALID: "Webhook signature verification failed",
	WEBHOOK_SECRET_MISSING: "Webhook secret is not configured",
	WEBHOOK_EVENT_ALREADY_PROCESSED: "Webhook event has already been processed",
	WEBHOOK_PROVIDER_MISMATCH: "Webhook provider does not match route provider",

	// Analytics
	ANALYTICS_QUERY_FAILED: "Failed to fetch payment analytics",
	ANALYTICS_INVALID_DATE_RANGE: "Invalid date range for analytics query",

	// Validation
	VALIDATION_ERROR: "Validation error",
	MISSING_FIELD: "Required field is missing",
	INVALID_REQUEST_BODY: "Invalid request body",
	BODY_MUST_BE_AN_OBJECT: "Body must be an object",

	// Onchain
	TX_HASH_ALREADY_USED: "Transaction hash has already been used for another payment",
	TX_AMOUNT_MISMATCH: "Transaction amount does not match the payment intent",
	TX_RECIPIENT_MISMATCH: "Transaction recipient does not match the payment intent",
	TX_NOT_FOUND: "Transaction not found on-chain",
	TX_INSUFFICIENT_CONFIRMATIONS: "Transaction has insufficient confirmations",
	INTENT_EXPIRED: "Payment intent has expired",
	INTENT_NOT_PENDING: "Payment intent is not in a pending state",
	CLIENT_SECRET_INVALID: "Invalid or expired client secret",

	// Server
	DATABASE_ERROR: "Database operation failed",
	INTERNAL_ERROR: "Internal server error",
});

export type KuluPayErrorCode = keyof typeof KULUPAY_ERROR_CODES;
