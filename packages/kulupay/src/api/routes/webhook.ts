import { KuluPayError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";

/**
 * Unified webhook endpoint for all payment providers.
 * Receives the raw request and delegates verification + normalization
 * to the provider's webhookHandler.
 */
export const webhook = createKuluPayEndpoint(
    "/webhook",
    {
        method: "POST",
        requireRequest: true,
    },
    async (ctx) => {
        try {
            const { providers, logger, orm, options } = ctx.context;
            const providerId = (ctx.query?.providerId as string) || (ctx.body as any)?.providerId;

            if (!providerId) {
                throw new KuluPayError("Missing providerId");
            }

            const provider = providers.get(providerId);
            if (!provider) {
                throw new KuluPayError(`Provider "${providerId}" not found.`);
            }

            if (!provider.webhookHandler) {
                throw new KuluPayError(`Provider "${providerId}" does not support webhooks.`);
            }

            logger.debug(`Processing webhook for provider: ${providerId}`);

            const event = await provider.webhookHandler(ctx.request, ctx.context);

            if (orm) {
                await orm.payment.update({
                    where: { id: event.externalId },
                    data: {
                        status: event.type,
                        metadata: {
                            ...event.data,
                            providerId: event.providerId,
                            timestamp: event.timestamp,
                        },
                    },
                });
            }

            if (options.databaseHooks?.payment?.update?.after) {
                await options.databaseHooks.payment.update.after(event.data as any, ctx.context);
            }

            return event;
        } catch (error: any) {
            if (error instanceof KuluPayError) {
                return {
                    error: error.message,
                    code: error.code || "WEBHOOK_ERROR",
                };
            }

            return {
                error: error.message || "Failed to process webhook",
                code: "INTERNAL_ERROR",
            };
        }
    }
);
