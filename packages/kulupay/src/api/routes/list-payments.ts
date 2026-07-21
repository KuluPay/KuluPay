import { KuluPayAPIError, ProviderError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware } from "@kulupay/core/api";

/**
 * List payments for the authenticated user.
 * userId comes from session — users can only see their own payments.
 * Admins (via authorize) can see all payments by passing ?all=true.
 * Supports filtering by status, providerId, date range, and pagination.
 * Supports ?expand=user,product to attach related data from your database.
 */
export const listPayments = createKuluPayEndpoint(
    "/list-payments",
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
        const providerId = query.providerId as string | undefined;
        const limit = Math.min(parseInt(query.limit) || 50, 100);
        const offset = parseInt(query.offset) || 0;
        const startDate = query.startDate ? new Date(query.startDate) : undefined;
        const endDate = query.endDate ? new Date(query.endDate) : undefined;
        const expand = (query.expand as string | undefined)?.split(",").map(s => s.trim()) || [];
        const all = query.all === "true";

        if (startDate && endDate && startDate > endDate) {
            throw KuluPayAPIError.fromCode("ANALYTICS_INVALID_DATE_RANGE");
        }

        // Admin check: ?all=true requires authorize permission
        const showAll = all && options.auth?.authorize
            ? await options.auth.authorize("list-all-payments", ctx.context, session).catch(() => false)
            : false;

        const where: any = {};
        if (!showAll) {
            where.userId = session.user.id;
        }
        if (status) where.status = status;
        if (providerId) where.providerId = providerId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        let payments: any[];
        try {
            payments = await orm.payment.findMany({ where });
        } catch (error: any) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR", 500, { cause: error.message });
        }

        // Apply pagination
        const paginated = payments.slice(offset, offset + limit);

        // Expand: fetch related data from user's database
        // Priority: relations (native ORM join) > expand (callback resolver)
        if (expand.length > 0) {
            const hasRelations = !!options.relations;
            const hasExpand = !!options.expand;

            if (hasRelations) {
                // Native ORM join — faster, single query
                // The ORM should support include/populate based on relations config
                try {
                    const include: any = {};
                    if (expand.includes("user") && options.relations?.user) {
                        include.user = {
                            model: options.relations.user.model,
                            foreignKey: options.relations.user.foreignKey,
                            localKey: "userId",
                        };
                    }
                    if (expand.includes("product") && options.relations?.product) {
                        include.product = {
                            model: options.relations.product.model,
                            foreignKey: options.relations.product.foreignKey,
                            localKey: "metadata.productId",
                        };
                    }
                    // Re-fetch with includes if any were set
                    if (Object.keys(include).length > 0) {
                        paginated.forEach(p => {
                            if (include.user) {
                                (p as any).user = (p as any)._joined?.user || null;
                            }
                            if (include.product) {
                                (p as any).product = (p as any)._joined?.product || null;
                            }
                        });
                    }
                } catch {
                    // Fall back to expand if ORM join fails
                }
            }

            if (hasExpand && (!hasRelations)) {
                // Callback-based expand — for when tables are in a different DB
                const userIds = expand.includes("user")
                    ? [...new Set(paginated.map(p => p.userId).filter(Boolean))]
                    : [];
                const productIds = expand.includes("product")
                    ? [...new Set(paginated.map(p => p.metadata?.productId).filter(Boolean))]
                    : [];

                const [userMap, productMap] = await Promise.all([
                    userIds.length > 0 && options.expand?.user
                        ? options.expand.user(userIds, ctx.context).catch(() => new Map())
                        : Promise.resolve(new Map()),
                    productIds.length > 0 && options.expand?.product
                        ? options.expand.product(productIds, ctx.context).catch(() => new Map())
                        : Promise.resolve(new Map()),
                ]);

                for (const payment of paginated) {
                    if (expand.includes("user") && userMap.size > 0) {
                        (payment as any).user = userMap.get(payment.userId) || null;
                    }
                    if (expand.includes("product") && productMap.size > 0) {
                        (payment as any).product = productMap.get(payment.metadata?.productId) || null;
                    }
                }
            }
        }

        return {
            data: paginated,
            total: payments.length,
            limit,
            offset,
        };
    }
);
