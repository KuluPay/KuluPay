import { KuluPayAPIError, KULUPAY_ERROR_CODES, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware } from "@kulupay/core/api";
import type { CreateIntentData } from "@kulupay/core";
import { validateCurrency, normalizeCurrency } from "@kulupay/core/utils";
import { z } from "zod";

/**
 * Endpoint to create a payment intent.
 * Requires authentication. userId is taken from the session, not the request body.
 */
export const createIntent = createKuluPayEndpoint(
    "/create-intent",
    {
        method: "POST",
        use: [sessionMiddleware, originCheckMiddleware] as any,
        body: z.record(z.string(), z.any()),
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
                try {
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
                } catch (err: any) {
                    if (err?.code === "UNIQUE_CONSTRAINT_VIOLATION" || err?.cause?.code === "23505") {
                        logger.debug(`Customer already exists (unique constraint), fetching by userId`);
                        const fallback = await orm.customer.findFirst({
                            where: { userId: session.user.id },
                        });
                        if (fallback) {
                            customerId = fallback.providerCustomerId;
                            logger.debug(`Using existing customer: ${customerId}`);
                        }
                    } else {
                        throw err;
                    }
                }
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
                metadata: { ...(intent.metadata || body.metadata || {}), raw: intent.raw },
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
                if (plugin.hooks?.after) {
                    for (const hook of plugin.hooks.after) {
                        if (hook.matcher({ path: "/create-intent", context: ctx.context as any })) {
                            await hook.handler({
                                path: "/create-intent",
                                context: { ...ctx.context, returned: intent } as any,
                            });
                        }
                    }
                }
            }
        }

        return {
            ...intent,
            chainConfig: provider.chainConfig ?? null,
            redirects: (provider as any).options?.redirects || {
                success: "/success",
            },
            checkoutUrl: options.checkoutUrl
                ? options.checkoutUrl
                    .replace("{intentId}", intent.id)
                    .replace("{clientSecret}", intent.clientSecret || "")
                : undefined,
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

        // Providers need their own identifier, not KuluPay's internal id:
        // a txHash for onchain payments once broadcast, or the provider's
        // own payment id for redirect providers (Stripe/PayPal/Chapa).
        const stored = orm ? await orm.payment.findFirst({ where: { id } }) : null;
        const providerLookupId = stored?.txHash || stored?.providerPaymentId || id;

        const intent = await provider.getIntent(providerLookupId).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
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

        return {
            ...intent,
            chainConfig: provider.chainConfig ?? null,
        };
    }
);

/**
 * Endpoint to confirm a payment intent with a transaction hash.
 * Called by the client after the user sends the on-chain transaction.
 * Uses clientSecret for auth — no session required (payment page may not have login).
 */
export const confirmIntent = createKuluPayEndpoint(
    "/confirm-intent",
    {
        method: "POST",
        use: [originCheckMiddleware] as any,
        body: z.record(z.string(), z.any()),
    },
    async (ctx) => {
        const { orm, logger } = ctx.context;
        const body = ctx.body as any;

        const { intentId, txHash, clientSecret } = body;

        if (!intentId || !txHash || !clientSecret) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        if (!orm) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR");
        }

        const payment = await orm.payment.findFirst({ where: { id: intentId } });
        if (!payment) {
            throw KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
        }

        if (payment.clientSecret !== clientSecret) {
            throw KuluPayAPIError.fromCode("CLIENT_SECRET_INVALID");
        }

        if (payment.status === "succeeded") {
            throw KuluPayAPIError.fromCode("PAYMENT_ALREADY_SUCCEEDED");
        }

        if (payment.status === "canceled" || payment.status === "expired") {
            throw KuluPayAPIError.fromCode("INTENT_NOT_PENDING");
        }

        if (payment.txHash && payment.txHash !== txHash) {
            throw KuluPayAPIError.fromCode("TX_HASH_ALREADY_USED");
        }

        const existingTx = await orm.payment.findFirst({ where: { txHash } });
        if (existingTx && existingTx.id !== intentId) {
            throw KuluPayAPIError.fromCode("TX_HASH_ALREADY_USED");
        }

        const now = new Date();
        await orm.payment.update({
            where: { id: intentId },
            data: {
                txHash,
                status: "pending_confirmation",
                updatedAt: now,
            },
        });

        logger.debug(`Intent ${intentId} confirmed with txHash: ${txHash}`);

        return {
            id: intentId,
            status: "pending_confirmation",
            txHash,
        };
    }
);

/**
 * Endpoint to verify a payment intent's on-chain status.
 * Called by the client to poll for confirmation status.
 * Uses clientSecret for auth — no session required.
 */
export const verifyIntent = createKuluPayEndpoint(
    "/verify-intent",
    {
        method: "GET",
    },
    async (ctx) => {
        const { providers, orm, logger } = ctx.context;
        const query = ctx.query as any;

        const { intentId, clientSecret } = query;

        if (!intentId || !clientSecret) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        if (!orm) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR");
        }

        const payment = await orm.payment.findFirst({ where: { id: intentId } });
        if (!payment) {
            throw KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
        }

        if (payment.clientSecret !== clientSecret) {
            throw KuluPayAPIError.fromCode("CLIENT_SECRET_INVALID");
        }

        if (payment.status === "succeeded" || payment.status === "failed" || payment.status === "expired") {
            return {
                id: intentId,
                status: payment.status,
                txHash: payment.txHash,
            };
        }

        if (!payment.txHash) {
            return {
                id: intentId,
                status: payment.status,
                txHash: null,
            };
        }

        const provider = providers.get(payment.providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        try {
            const intent = await provider.getIntent(payment.txHash);

            // Verify the on-chain transaction matches the expected payment.
            // If the provider extracted onchainRecipient/onchainAmount from the
            // actual tx, compare them to the values we stored at createIntent.
            const paymentMeta = payment.metadata as any;
            const expectedRecipient = paymentMeta?.raw?.to;
            const expectedAmount = paymentMeta?.raw?.amount;
            const intentMeta = intent.metadata as any;
            const onchainRecipient = intentMeta?.onchainRecipient;
            const onchainAmount = intentMeta?.onchainAmount;

            if (intent.status === "succeeded" && onchainRecipient && onchainAmount) {
                const recipientMatch = onchainRecipient.toLowerCase() === String(expectedRecipient).toLowerCase();
                const amountMatch = onchainAmount === String(expectedAmount);

                if (!recipientMatch || !amountMatch) {
                    logger.debug(`verifyIntent VERIFICATION FAILED for ${intentId}: recipient=${recipientMatch} amount=${amountMatch} (expected ${expectedRecipient}/${expectedAmount}, got ${onchainRecipient}/${onchainAmount})`);
                    const failedIntent = { ...intent, status: "failed" as const };
                    await orm.payment.update({
                        where: { id: intentId },
                        data: { status: "failed", updatedAt: new Date() },
                    });
                    return {
                        id: intentId,
                        status: "failed",
                        txHash: payment.txHash,
                        error: "On-chain verification failed: recipient or amount mismatch",
                    };
                }
            }

            if (intent.status !== payment.status) {
                const now = new Date();
                await orm.payment.update({
                    where: { id: intentId },
                    data: {
                        status: intent.status,
                        updatedAt: now,
                    },
                });

                logger.debug(`Intent ${intentId} status updated: ${payment.status} → ${intent.status}`);
            }

            const metadata = intent.metadata as any;
            const confirmations = metadata?.confirmations;
            const requiredConfirmations = metadata?.requiredConfirmations;

            return {
                id: intentId,
                status: intent.status,
                txHash: payment.txHash,
                confirmations: confirmations !== undefined
                    ? { current: confirmations, required: requiredConfirmations ?? 0 }
                    : undefined,
            };
        } catch (error: any) {
            logger.debug(`verifyIntent error for ${intentId}: ${error?.constructor?.name} — ${error?.message}`);
            if (error?.stack) logger.debug(`verifyIntent stack: ${error.stack}`);
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        }
    }
);

/**
 * Endpoint to get full intent details for checkout page rendering.
 * Uses clientSecret for auth — no session required.
 * Returns the raw payment data needed to render the checkout UI (amount, recipient, token, etc.)
 */
export const checkoutIntent = createKuluPayEndpoint(
    "/checkout-intent",
    {
        method: "GET",
    },
    async (ctx) => {
        const { orm, logger } = ctx.context;
        const query = ctx.query as any;

        const { intentId, clientSecret } = query;

        if (!intentId || !clientSecret) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        if (!orm) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR");
        }

        const payment = await orm.payment.findFirst({ where: { id: intentId } });
        if (!payment) {
            throw KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
        }

        if (payment.clientSecret !== clientSecret) {
            throw KuluPayAPIError.fromCode("CLIENT_SECRET_INVALID");
        }

        const metadata = payment.metadata as any;

        logger.debug("checkoutIntent raw data", {
            metadataRaw: metadata?.raw,
            metadataRawTo: metadata?.raw?.to,
            metadataRawValue: metadata?.raw?.value,
            metadataRawData: metadata?.raw?.data ? metadata.raw.data.slice(0, 20) + "..." : null,
        });

        const provider = ctx.context.providers.get(payment.providerId);
        const checkoutFlow = provider?.checkout || "none";

        return {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            providerId: payment.providerId,
            checkoutFlow,
            clientSecret: payment.clientSecret,
            txHash: payment.txHash,
            metadata: metadata,
            type: payment.type,
            description: payment.description,
            raw: metadata?.raw ? { ...metadata.raw } : null,
            deadline: metadata?.deadline || null,
            recipient: metadata?.recipient || metadata?.to || null,
            token: metadata?.token ? { ...metadata.token } : null,
            network: metadata?.network || (metadata?.chain ? { name: metadata.chain, family: metadata.family } : null),
            signature: metadata?.signature || null,
            contractAddress: metadata?.contractAddress || null,
            chainConfig: provider?.chainConfig ?? null,
        };
    }
);
