import { KuluPayAPIError, KULUPAY_ERROR_CODES, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware } from "@kulupay/core/api";
import type { CreateIntentData } from "@kulupay/core";
import { validateCurrency, normalizeCurrency } from "@kulupay/core/utils";

/**
 * Endpoint to create a payment intent.
 * Requires authentication. userId is taken from the session, not the request body.
 */
export const createIntent = createKuluPayEndpoint(
    "/create-intent",
    {
        method: "POST",
        use: [sessionMiddleware, originCheckMiddleware] as any,
    },
    async (ctx) => {
        const { providers, logger, orm, options } = ctx.context;
        const body = ctx.body as any;
        const session = ctx.context.session;
        if (!session?.user) {
            throw KuluPayAPIError.fromCode("UNAUTHORIZED");
        }

        const providerId = body.providerId || Array.from(providers.keys())[0];
        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        logger.debug(`Creating intent for provider: ${providerId}`, body);

        // Auto-create or find customer for this user + provider
        let customerId: string | undefined;
        if (orm && provider.createCustomer) {
            const existing = await orm.customer.findFirst({
                where: { userId: session.user.id, providerId },
            });
            if (existing) {
                customerId = existing.providerCustomerId;
                logger.debug(`Found existing customer: ${customerId}`);
            } else {
                logger.debug(`Creating new customer for user: ${session.user.id}`);
                const customer = await provider.createCustomer({
                    userId: session.user.id,
                    providerId,
                    email: (session.user as any).email,
                    name: (session.user as any).name,
                });
                await orm.customer.create({
                    data: {
                        id: customer.id,
                        userId: session.user.id,
                        providerId,
                        providerCustomerId: customer.providerCustomerId,
                        createdAt: customer.createdAt || new Date(),
                        updatedAt: customer.updatedAt || new Date(),
                    },
                });
                customerId = customer.providerCustomerId;
                logger.debug(`Created new customer: ${customerId}`);
            }
        }

        const intentData: CreateIntentData = {
            ...body,
            userId: session.user.id,
            providerId,
            customerId,
        };

        // If pricing.resolvePrice is configured, override amount/currency
        // with server-side resolved values — prevents client-side price manipulation
        if (options.pricing?.resolvePrice) {
            try {
                const resolved = await options.pricing.resolvePrice(intentData, ctx.context);
                if (!resolved.amount || resolved.amount <= 0) {
                    throw KuluPayAPIError.fromCode("PRICING_AMOUNT_MUST_BE_POSITIVE");
                }
                if (!resolved.currency || typeof resolved.currency !== "string") {
                    throw KuluPayAPIError.fromCode("PRICING_CURRENCY_REQUIRED");
                }
                intentData.amount = resolved.amount;
                intentData.currency = resolved.currency;
            } catch (error: any) {
                if (error instanceof KuluPayAPIError) throw error;
                throw KuluPayAPIError.fromCode("PRICING_RESOLVE_FAILED", 500, { cause: error.message });
            }
        }

        // Validate currency (ISO 4217 — 3 lowercase letters)
        if (!validateCurrency(intentData.currency)) {
            throw KuluPayAPIError.fromCode("INVALID_CURRENCY");
        }
        intentData.currency = normalizeCurrency(intentData.currency);

        const intent = await provider.createIntent(intentData).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            const now = new Date();
            const paymentData = {
                id: intent.id,
                userId: session!.user.id,
                amount: intent.amount,
                currency: intent.currency,
                status: intent.status,
                providerId,
                metadata: intent.metadata || body.metadata || {},
                type: intent.type || body.type || "one_time",
                description: intent.description || body.description || null,
                customerId: customerId || body.customerId || null,
                providerPaymentId: intent.providerPaymentId || intent.id,
                clientSecret: intent.clientSecret || null,
                createdAt: now,
                updatedAt: now,
            };

            let finalPaymentData = paymentData;
            if (options.databaseHooks?.payment?.create?.before) {
                const result = await options.databaseHooks.payment.create.before(paymentData as any, ctx.context);
                if (result) finalPaymentData = result as any;
            }

            await orm.payment.create({ data: finalPaymentData });

            if (options.databaseHooks?.payment?.create?.after) {
                await options.databaseHooks.payment.create.after(finalPaymentData as any, ctx.context);
            }
        }

        if (options.plugins) {
            for (const plugin of options.plugins) {
                if (plugin.hooks?.["intent:created"]) {
                    await plugin.hooks["intent:created"](intent);
                }
            }
        }

        return {
            ...intent,
            redirects: (provider as any).options?.redirects || {
                success: "/success",
            }
        };
    }
);

/**
 * Endpoint to retrieve a payment intent by ID.
 * Requires authentication + ownership check.
 */
export const getIntent = createKuluPayEndpoint(
    "/get-intent",
    {
        method: "GET",
        use: [
            sessionMiddleware,
            ownershipMiddleware(async (ctx: any) => {
                const id = ctx.query?.id as string;
                if (!id) return null;
                const payment = await ctx.context.orm.payment.findFirst({ where: { id } });
                return payment?.userId || null;
            }),
        ] as any,
    },
    async (ctx) => {
        const { providers, logger, orm, options } = ctx.context;
        const id = ctx.query?.id as string;
        const providerId = (ctx.query?.providerId as string) || Array.from(providers.keys())[0];

        if (!id) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        const intent = await provider.getIntent(id).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            const stored = await orm.payment.findFirst({ where: { id } });
            if (stored && stored.status !== intent.status) {
                const updateData = { status: intent.status, updatedAt: new Date() };

                let finalUpdateData = { ...updateData };
                if (options.databaseHooks?.payment?.update?.before) {
                    const result = await options.databaseHooks.payment.update.before(updateData as any, ctx.context);
                    if (result) {
                        finalUpdateData = { ...finalUpdateData, ...result as any };
                    }
                }

                await orm.payment.update({ where: { id }, data: finalUpdateData });

                if (options.databaseHooks?.payment?.update?.after) {
                    const updatedPayment = await orm.payment.findFirst({ where: { id } });
                    await options.databaseHooks.payment.update.after(updatedPayment as any, ctx.context);
                }
            }
        }

        return intent;
    }
);
