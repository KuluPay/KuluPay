import { defineErrorCodes } from "../../utils/error-codes";

export const STRIPE_ERROR_CODES = defineErrorCodes({
	STRIPE_API_ERROR: "Stripe API returned an error",
	STRIPE_CARD_DECLINED: "The card was declined",
	STRIPE_INSUFFICIENT_FUNDS: "Insufficient funds",
	STRIPE_EXPIRED_CARD: "The card has expired",
	STRIPE_INCORRECT_CVC: "Incorrect CVC code",
	STRIPE_PROCESSING_ERROR: "Payment processing error",
	STRIPE_RATE_LIMIT_ERROR: "Stripe rate limit exceeded",
	STRIPE_INVALID_REQUEST: "Invalid request to Stripe API",
	STRIPE_AUTHENTICATION_REQUIRED: "Additional authentication required for this payment",
	STRIPE_PAYMENT_INTENT_CREATION_FAILED: "Failed to create Stripe payment intent",
	STRIPE_PAYMENT_INTENT_RETRIEVAL_FAILED: "Failed to retrieve Stripe payment intent",
	STRIPE_PAYMENT_INTENT_CANCELLATION_FAILED: "Failed to cancel Stripe payment intent",
	STRIPE_CUSTOMER_CREATION_FAILED: "Failed to create Stripe customer",
	STRIPE_CUSTOMER_RETRIEVAL_FAILED: "Failed to retrieve Stripe customer",
	STRIPE_SUBSCRIPTION_CREATION_FAILED: "Failed to create Stripe subscription",
	STRIPE_SUBSCRIPTION_RETRIEVAL_FAILED: "Failed to retrieve Stripe subscription",
	STRIPE_SUBSCRIPTION_CANCELLATION_FAILED: "Failed to cancel Stripe subscription",
	STRIPE_REFUND_FAILED: "Failed to refund Stripe payment",
	STRIPE_CAPTURE_FAILED: "Failed to capture Stripe payment",
	STRIPE_WEBHOOK_CONSTRUCTION_FAILED: "Failed to construct Stripe webhook event",
	STRIPE_WEBHOOK_SIGNATURE_MISSING: "Stripe signature not found in request headers",
	STRIPE_WEBHOOK_SECRET_MISSING: "Stripe webhook secret is not configured",
	STRIPE_SDK_NOT_FOUND: "Stripe SDK not found. Install with: npm install stripe",
});

export type StripeErrorCode = keyof typeof STRIPE_ERROR_CODES;
