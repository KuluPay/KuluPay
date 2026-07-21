import { KuluPayAPIError, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import type { PaymentStatus } from "@kulupay/core";

/**
 * Maps webhook event types to KuluPay PaymentStatus.
 * Handles events from Stripe, Chapa, and other providers.
 */
const mapWebhookEventToStatus = (eventType: string): PaymentStatus => {
    if (eventType.includes("succeeded") || eventType.includes("completed") || eventType.includes("paid")) {
        return "succeeded";
    }
    if (eventType.includes("failed") || eventType.includes("declined") || eventType.includes("canceled")) {
        return "failed";
    }
    if (eventType.includes("processing") || eventType.includes("pending")) {
        return "processing";
    }
    return "pending";
};

/**
 * Unified webhook endpoint for all payment providers.
 * Receives the raw request and delegates verification + normalization
 * to the provider's webhookHandler.
 * No session middleware — webhooks use provider signature verification.
 */
export const webhook = createKuluPayEndpoint(
    "/webhook",
    {
        method: "POST",
        requireRequest: true,
    },
    async (ctx) => {
        const { providers, logger, orm, options } = ctx.context;
        const providerId = (ctx.query?.providerId as string) || (ctx.body as any)?.providerId;

        if (!providerId) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        if (!provider.webhookHandler) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        logger.debug(`Processing webhook for provider: ${providerId}`);

        const event = await provider.webhookHandler(ctx.request, ctx.context).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(400, {
                    code: error.code || "WEBHOOK_SIGNATURE_INVALID",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            const paymentId = event.data?.id || event.data?.object || event.externalId;

            const existing = await orm.payment.findFirst({ where: { id: paymentId } }).catch(() => null);

            if (existing) {
                const newStatus = mapWebhookEventToStatus(event.type);

                if (existing.status === newStatus) {
                    logger.debug(`Webhook event ${event.externalId} already processed (same status)`);
                    return { received: true, duplicate: true };
                }

                await orm.payment.update({
                    where: { id: paymentId },
                    data: {
                        status: newStatus,
                        metadata: {
                            ...(existing.metadata || {}),
                            lastWebhookEvent: {
                                type: event.type,
                                providerId: event.providerId,
                                externalId: event.externalId,
                                timestamp: event.timestamp,
                            },
                        },
                        updatedAt: new Date(),
                    },
                });

                if (options.databaseHooks?.payment?.update?.after) {
                    await options.databaseHooks.payment.update.after(event.data as any, ctx.context);
                }
            } else {
                logger.debug(`Webhook event for unknown payment: ${paymentId}. Storing event metadata.`);
            }
        }

        return { received: true, event };
    }
);
