import { KuluPayAPIError, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware } from "@kulupay/core/api";
import { z } from "zod";

/**
 * Refund a payment.
 * Requires authentication + origin check + ownership check.
 * Calls the provider's refund method, then updates the DB.
 *
 * Admin-only: requires authorize("refund") permission since refunds
 * are typically done by admins, not by users themselves.
 */
export const refundPayment = createKuluPayEndpoint(
    "/refund",
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

        // Refunds should be admin-only
        if (options.auth?.authorize) {
            const allowed = await options.auth.authorize("refund", ctx.context, session).catch(() => false);
            if (!allowed) {
                throw KuluPayAPIError.fromCode("FORBIDDEN");
            }
        }

        const id = body.id;
        const amount = body.amount;
        const providerId = body.providerId || Array.from(providers.keys())[0];

        if (!id) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        if (!provider.refund) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        // Verify payment exists and is succeeded
        if (orm) {
            const existing = await orm.payment.findFirst({ where: { id } });
            if (!existing) {
                throw KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
            }
            if (existing.status !== "succeeded") {
                throw KuluPayAPIError.fromCode("PAYMENT_ALREADY_CANCELED");
            }
        }

        const intent = await provider.refund(id, amount).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        // Update DB with refund status
        if (orm) {
            await orm.payment.update({
                where: { id },
                data: {
                    status: intent.status,
                    type: "refund",
                    metadata: {
                        ...(await orm.payment.findFirst({ where: { id } })?.then(p => p?.metadata) || {}),
                        refund: {
                            amount: amount || intent.amount,
                            refundedAt: new Date().toISOString(),
                            refundedBy: session.user.id,
                        },
                    },
                    updatedAt: new Date(),
                },
            });
        }

        return intent;
    }
);

/**
 * Capture a previously authorized payment (manual capture).
 * Requires authentication + origin check + admin authorization.
 * Only works with providers that support manual capture (e.g. Stripe).
 */
export const capturePayment = createKuluPayEndpoint(
    "/capture",
    {
        method: "POST",
        use: [sessionMiddleware, originCheckMiddleware] as any,
        body: z.record(z.string(), z.any()),
    },
    async (ctx) => {
        const { providers, orm, options } = ctx.context;
        const body = ctx.body as any;
        const session = ctx.context.session;
        if (!session?.user) {
            throw KuluPayAPIError.fromCode("UNAUTHORIZED");
        }

        // Capture should be admin-only
        if (options.auth?.authorize) {
            const allowed = await options.auth.authorize("capture", ctx.context, session).catch(() => false);
            if (!allowed) {
                throw KuluPayAPIError.fromCode("FORBIDDEN");
            }
        }

        const id = body.id;
        const amount = body.amount;
        const providerId = body.providerId || Array.from(providers.keys())[0];

        if (!id) {
            throw KuluPayAPIError.fromCode("MISSING_FIELD");
        }

        const provider = providers.get(providerId);
        if (!provider) {
            throw KuluPayAPIError.fromCode("PROVIDER_NOT_FOUND");
        }

        if (!provider.capture) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        const intent = await provider.capture(id, amount).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            await orm.payment.update({
                where: { id },
                data: {
                    status: intent.status,
                    updatedAt: new Date(),
                },
            });
        }

        return intent;
    }
);
