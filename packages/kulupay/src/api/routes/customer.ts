import { KuluPayAPIError, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware } from "@kulupay/core/api";

/**
 * Create a customer record in the provider (e.g. Stripe Customer).
 * userId comes from session. No business logic — thin pass-through.
 */
export const createCustomer = createKuluPayEndpoint(
    "/create-customer",
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

        if (!provider.createCustomer) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        const customer = await provider.createCustomer({
            ...body,
            userId: session.user.id,
            providerId,
        }).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        if (orm) {
            await orm.customer.create({
                data: {
                    id: customer.id,
                    userId: session.user.id,
                    providerId,
                    providerCustomerId: customer.providerCustomerId,
                    createdAt: customer.createdAt,
                    updatedAt: customer.updatedAt,
                },
            });
        }

        return customer;
    }
);

/**
 * Get a customer by ID.
 * Ownership check: customer must belong to the session user.
 */
export const getCustomer = createKuluPayEndpoint(
    "/get-customer",
    {
        method: "GET",
        use: [
            sessionMiddleware,
            ownershipMiddleware(async (ctx: any) => {
                const id = ctx.query?.id as string;
                if (!id) return null;
                const customer = await ctx.context.orm.customer.findFirst({ where: { id } });
                return customer?.userId || null;
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

        if (!provider.getCustomer) {
            throw KuluPayAPIError.fromCode("PROVIDER_METHOD_NOT_SUPPORTED");
        }

        const customer = await provider.getCustomer(id).catch((error: any) => {
            if (error instanceof ProviderError) {
                throw KuluPayAPIError.from(502, {
                    code: error.code || "PROVIDER_ERROR",
                    message: error.message,
                }, error.raw);
            }
            throw KuluPayAPIError.fromCode("INTERNAL_ERROR");
        });

        return customer;
    }
);
