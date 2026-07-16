import { KuluPayError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";

/**
 * Endpoint to create a payment intent.
 * Matches the POST /create-intent pattern.
 */
export const createIntent = createKuluPayEndpoint(
    "/create-intent",
    {
        method: "POST",
    },
    async (ctx) => {
        try {
            const { providers, logger, orm, options } = ctx.context;
            const body = ctx.body as any;
            
            // Use the provided providerId or fall back to the first configured provider from the runtime map
            const providerId = body.providerId || Array.from(providers.keys())[0];
            
            const provider = providers.get(providerId);
            if (!provider) {
                return {
                    error: `Provider "${providerId}" not found.`,
                    code: "PROVIDER_NOT_FOUND"
                };
            }

            logger.debug(`Creating intent for provider: ${providerId}`, body);
            
            // Call the provider-specific implementation
            const intent = await provider.createIntent(body);

            // If database is configured, save the intent using Farming ORM
            if (orm) {
                const paymentData = {
                    id: intent.id,
                    userId: body.userId || "anonymous",
                    amount: intent.amount,
                    currency: intent.currency,
                    status: intent.status,
                    providerId,
                    metadata: intent.metadata,
                };

                // TREND: Trigger 'before' create hook
                let finalPaymentData = paymentData;
                if (options.databaseHooks?.payment?.create?.before) {
                    const result = await options.databaseHooks.payment.create.before(paymentData as any, ctx.context);
                    if (result) finalPaymentData = result as any;
                }

                await orm.payment.create({
                    data: finalPaymentData
                });

                // TREND: Trigger 'after' create hook
                if (options.databaseHooks?.payment?.create?.after) {
                    await options.databaseHooks.payment.create.after(finalPaymentData as any, ctx.context);
                }
            }

            // Run plugin hooks (Legacy/Plugin style)
            if (options.plugins) {
                for (const plugin of options.plugins) {
                    if (plugin.hooks?.["intent:created"]) {
                        await plugin.hooks["intent:created"](intent);
                    }
                }
            }

            // Return the intent and its provider's redirect config
            return {
                ...intent,
                redirects: (provider as any).options?.redirects || {
                    success: "/success",
                }
            };
        } catch (error: any) {
            // Return error as a proper response object
            if (error instanceof KuluPayError) {
                return {
                    error: error.message,
                    code: error.code || "PAYMENT_ERROR"
                };
            }
            
            // Wrap other errors
            return {
                error: error.message || "Failed to create payment intent",
                code: "INTERNAL_ERROR"
            };
        }
    }
);

/**
 * Endpoint to retrieve a payment intent by ID.
 * Matches the GET /get-intent pattern.
 */
export const getIntent = createKuluPayEndpoint(
    "/get-intent",
    {
        method: "GET",
    },
    async (ctx) => {
        const { providers, logger, orm, options } = ctx.context;
        const id = ctx.query?.id as string;
        const providerId = (ctx.query?.providerId as string) || Array.from(providers.keys())[0];

        if (!id) throw new KuluPayError("Missing id");

        const provider = providers.get(providerId);
        if (!provider) {
            throw new KuluPayError(`Provider "${providerId}" not found.`);
        }

        // Fetch the intent from the provider
        const intent = await provider.getIntent(id);

        // Update the status in our database if it has changed
        if (orm) {
            const stored = await orm.payment.findFirst({
                where: { id }
            });
            if (stored && stored.status !== intent.status) {
                const updateData = { status: intent.status };

                // TREND: Trigger 'before' update hook
                let finalUpdateData = { ...updateData };
                if (options.databaseHooks?.payment?.update?.before) {
                    const result = await options.databaseHooks.payment.update.before(updateData as any, ctx.context);
                    if (result) {
                        finalUpdateData = {
                            ...finalUpdateData,
                            ...result as any,
                        };
                    }
                }

                await orm.payment.update({
                    where: { id },
                    data: finalUpdateData
                });

                // TREND: Trigger 'after' update hook
                if (options.databaseHooks?.payment?.update?.after) {
                    // Fetch full payment for the 'after' hook
                    const updatedPayment = await orm.payment.findFirst({
                        where: { id }
                    });
                    await options.databaseHooks.payment.update.after(updatedPayment as any, ctx.context);
                }
            }
        }

        return intent;
    }
);
