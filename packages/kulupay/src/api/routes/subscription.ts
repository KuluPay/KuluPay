import { KuluPayAPIError, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware } from "@kulupay/core/api";
import type { CreateSubscriptionData } from "@kulupay/core";

/**
 * Create a subscription.
 * Requires authentication + origin check.
 * userId comes from session. customerId and planId come from the request body.
 * The planId is a provider-specific price ID (e.g. Stripe's price_xxx).
 * The actual amount/currency is resolved by the provider — KuluPay doesn't set prices.
 */
export const createSubscription = createKuluPayEndpoint(
    "/create-subscription",
    {
        method: "POST",
        use: [sessionMiddleware, originCheckMiddleware] as any,
    },
    async (ctx) => {
        const { providers, orm, options } = ctx.context;
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

        if (!provider.createSubscription) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        if (!body.customerId) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }
        if (!body.planId) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const subData: CreateSubscriptionData = {
            ...body,
            userId: session.user.id,
            providerId,
        };

        const subscription = await provider.createSubscription(subData).catch((error: any) => {
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
            await orm.subscription.create({
                data: {
                    id: subscription.id,
                    userId: session.user.id,
                    planId: subscription.planId,
                    status: subscription.status,
                    providerSubscriptionId: subscription.providerSubscriptionId,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                    createdAt: subscription.createdAt || now,
                    updatedAt: now,
                },
            }).catch((error: any) => {
                throw KuluPayAPIError.fromCode("DATABASE_ERROR", 500, { cause: error.message });
            });
        }

        if (options.databaseHooks?.payment?.create?.after) {
            await options.databaseHooks.payment.create.after(subscription as any, ctx.context);
        }

        return subscription;
    }
);

/**
 * Get a subscription by ID.
 * Requires authentication + ownership check.
 */
export const getSubscription = createKuluPayEndpoint(
    "/get-subscription",
    {
        method: "GET",
        use: [
            sessionMiddleware,
            ownershipMiddleware(async (ctx: any) => {
                const id = ctx.query?.id as string;
                if (!id) return null;
                const sub = await ctx.context.orm.subscription.findFirst({ where: { id } });
                return sub?.userId || null;
            }),
        ] as any,
    },
    async (ctx) => {
        const { providers, orm } = ctx.context;
        const id = ctx.query?.id as string;
        const providerId = (ctx.query?.providerId as string) || Array.from(providers.keys())[0];

        if (!id) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        if (!provider.getSubscription) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        const subscription = await provider.getSubscription(id).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        // Sync DB with provider status
        if (orm) {
            const stored = await orm.subscription.findFirst({ where: { id } });
            if (stored && stored.status !== subscription.status) {
                await orm.subscription.update({
                    where: { id },
                    data: {
                        status: subscription.status,
                        currentPeriodEnd: subscription.currentPeriodEnd,
                        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                        updatedAt: new Date(),
                    },
                });
            }
        }

        return subscription;
    }
);

/**
 * Cancel a subscription.
 * Requires authentication + ownership check.
 * Calls the provider's cancelSubscription, then updates the DB.
 */
export const cancelSubscription = createKuluPayEndpoint(
    "/cancel-subscription",
    {
        method: "POST",
        use: [
            sessionMiddleware,
            originCheckMiddleware,
            ownershipMiddleware(async (ctx: any) => {
                const id = ctx.body?.id as string;
                if (!id) return null;
                const sub = await ctx.context.orm.subscription.findFirst({ where: { id } });
                return sub?.userId || null;
            }),
        ] as any,
    },
    async (ctx) => {
        const { providers, orm } = ctx.context;
        const body = ctx.body as any;
        const id = body.id;
        const providerId = body.providerId || Array.from(providers.keys())[0];

        if (!id) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        if (!provider.cancelSubscription) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        // Check current status before canceling
        if (orm) {
            const existing = await orm.subscription.findFirst({ where: { id } });
            if (existing?.status === "canceled") {
                throw KuluPayAPIError.fromCode("SUBSCRIPTION_NOT_CANCELLABLE");
            }
        }

        const subscription = await provider.cancelSubscription(id).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            await orm.subscription.update({
                where: { id },
                data: {
                    status: subscription.status,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    updatedAt: new Date(),
                },
            });
        }

        return subscription;
    }
);

/**
 * List subscriptions for the authenticated user.
 * Admins (via authorize) can see all subscriptions with ?all=true.
 */
export const listSubscriptions = createKuluPayEndpoint(
    "/list-subscriptions",
    {
        method: "GET",
        use: [sessionMiddleware] as any,
    },
    async (ctx) => {
        const { orm, options } = ctx.context;
        const session = ctx.context.session;
        if (!session?.user) {
            throw KuluPayAPIError.fromCode("UNAUTHORIZED");
        }

        if (!orm) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR");
        }

        const query = ctx.query as any;
        const status = query.status as string | undefined;
        const all = query.all === "true";

        const showAll = all && options.auth?.authorize
            ? await options.auth.authorize("list-all-subscriptions", ctx.context, session).catch(() => false)
            : false;

        const where: any = {};
        if (!showAll) {
            where.userId = session.user.id;
        }
        if (status) where.status = status;

        let subscriptions: any[];
        try {
            subscriptions = await orm.subscription.findMany({ where });
        } catch (error: any) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR", 500, { cause: error.message });
        }

        return {
            data: subscriptions,
            total: subscriptions.length,
        };
    }
);
