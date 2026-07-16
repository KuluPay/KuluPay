import { describe, it, expect, beforeEach } from "vitest";
import { createOrm, createMemoryDriver } from "@farming-labs/orm";
import { kuluPaySchema } from "./schema";

describe("KuluPay ORM Schema", () => {
    let orm: ReturnType<typeof createOrm<typeof kuluPaySchema>>;

    beforeEach(() => {
        orm = createOrm({
            schema: kuluPaySchema,
            driver: createMemoryDriver(),
        });
    });

    it("should create a payment record", async () => {
        const payment = await orm.payment.create({
            data: {
                id: "pay_123",
                amount: 1000,
                currency: "USD",
                status: "pending",
                userId: "user_1",
                providerId: "stripe"
            }
        });

        expect(payment.id).toBe("pay_123");
        expect(payment.amount).toBe(1000);
    });

    it("should create and find a customer", async () => {
        await orm.customer.create({
            data: {
                id: "cus_123",
                userId: "user_1",
                providerId: "stripe",
                providerCustomerId: "cus_stripe_123"
            }
        });

        const customer = await orm.customer.findFirst({
            where: { userId: "user_1", providerId: "stripe" }
        });

        expect(customer).toBeDefined();
        expect(customer?.providerCustomerId).toBe("cus_stripe_123");
    });
});
