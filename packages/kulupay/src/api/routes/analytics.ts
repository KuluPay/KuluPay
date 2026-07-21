import { KuluPayAPIError } from "@kulupay/core/error";
import { createKuluPayEndpoint } from "@kulupay/core/api";
import { sessionMiddleware } from "@kulupay/core/api";
import type { PaymentAnalytics, PaymentStatus } from "@kulupay/core";

/**
 * Payment analytics endpoint.
 * Aggregates data from the payment table — no business logic, just DB queries.
 *
 * Requires authentication. The `authorize` function (if configured) can be used
 * to restrict analytics to admins only.
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - providerId: filter by provider
 * - groupBy: "day" | "week" | "month" | "provider" | "status" | "type"
 *
 * Product/price info: KuluPay stores whatever you put in `metadata` on each payment.
 * If your app stores `metadata: { productId, productName, price }`, you can
 * query payments and group by those fields in YOUR frontend — KuluPay just
 * returns the raw aggregates.
 */
export const getAnalytics = createKuluPayEndpoint(
    "/analytics",
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

        // Optional: use authorize function to restrict to admins
        if (options.auth?.authorize) {
            const allowed = await options.auth.authorize("analytics", ctx.context, session);
            if (!allowed) {
                throw KuluPayAPIError.fromCode("FORBIDDEN");
            }
        }

        if (!orm) {
            throw KuluPayAPIError.fromCode("DATABASE_ERROR");
        }

        const query = ctx.query as any;
        const startDate = query.startDate ? new Date(query.startDate) : undefined;
        const endDate = query.endDate ? new Date(query.endDate) : undefined;
        const providerId = query.providerId as string | undefined;

        if (startDate && endDate && startDate > endDate) {
            throw KuluPayAPIError.fromCode("ANALYTICS_INVALID_DATE_RANGE");
        }

        // Build where clause
        const where: any = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }
        if (providerId) {
            where.providerId = providerId;
        }

        let payments: any[];
        try {
            payments = await orm.payment.findMany({ where });
        } catch (error: any) {
            throw KuluPayAPIError.fromCode("ANALYTICS_QUERY_FAILED", 500, { cause: error.message });
        }

        // Aggregate
        const analytics: PaymentAnalytics = {
            totalRevenue: 0,
            totalPayments: payments.length,
            successfulPayments: 0,
            failedPayments: 0,
            pendingPayments: 0,
            refundedAmount: 0,
            averagePaymentAmount: 0,
            byProvider: [],
            byStatus: [],
            byType: [],
        };

        const providerMap = new Map<string, { revenue: number; count: number }>();
        const statusMap = new Map<string, { count: number; amount: number }>();
        const typeMap = new Map<string, { count: number; amount: number }>();
        const dateMap = new Map<string, { revenue: number; count: number }>();

        for (const payment of payments) {
            const amount = Number(payment.amount) || 0;
            const status = payment.status as PaymentStatus;
            const type = payment.type || "one_time";
            const pid = payment.providerId || "unknown";

            if (status === "succeeded") {
                analytics.successfulPayments++;
                if (type === "refund") {
                    analytics.refundedAmount += amount;
                } else {
                    analytics.totalRevenue += amount;
                }
            } else if (status === "failed") {
                analytics.failedPayments++;
            } else if (status === "pending" || status === "processing") {
                analytics.pendingPayments++;
            }

            // by provider
            const pEntry = providerMap.get(pid) || { revenue: 0, count: 0 };
            if (status === "succeeded" && type !== "refund") pEntry.revenue += amount;
            pEntry.count++;
            providerMap.set(pid, pEntry);

            // by status
            const sEntry = statusMap.get(status) || { count: 0, amount: 0 };
            sEntry.count++;
            sEntry.amount += amount;
            statusMap.set(status, sEntry);

            // by type
            const tEntry = typeMap.get(type) || { count: 0, amount: 0 };
            tEntry.count++;
            tEntry.amount += amount;
            typeMap.set(type, tEntry);

            // by date (if groupBy is day/week/month)
            if (query.groupBy && ["day", "week", "month"].includes(query.groupBy)) {
                const date = new Date(payment.createdAt);
                let key: string;
                if (query.groupBy === "day") {
                    key = date.toISOString().split("T")[0];
                } else if (query.groupBy === "week") {
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split("T")[0];
                } else {
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                }
                const dEntry = dateMap.get(key) || { revenue: 0, count: 0 };
                if (status === "succeeded" && type !== "refund") dEntry.revenue += amount;
                dEntry.count++;
                dateMap.set(key, dEntry);
            }
        }

        analytics.averagePaymentAmount = analytics.totalPayments > 0
            ? analytics.totalRevenue / analytics.successfulPayments
            : 0;

        analytics.byProvider = Array.from(providerMap.entries()).map(([providerId, v]) => ({
            providerId,
            ...v,
        }));
        analytics.byStatus = Array.from(statusMap.entries()).map(([status, v]) => ({
            status: status as PaymentStatus,
            ...v,
        }));
        analytics.byType = Array.from(typeMap.entries()).map(([type, v]) => ({ type, ...v }));

        if (dateMap.size > 0) {
            analytics.byDate = Array.from(dateMap.entries())
                .map(([date, v]) => ({ date, ...v }))
                .sort((a, b) => a.date.localeCompare(b.date));
        }

        return analytics;
    }
);
