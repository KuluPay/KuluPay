import { createOrm, createMemoryDriver } from "@farming-labs/orm";
import { kuluPaySchema } from "./schema";

async function runTest() {
    console.log("🚀 Starting KuluPay ORM Validation...");

    const orm = createOrm({
        schema: kuluPaySchema,
        driver: createMemoryDriver(),
    });

    try {
        // 1. Test Payment Creation
        const payment = await orm.payment.create({
            data: {
                id: "pay_test_1",
                amount: 5000,
                currency: "USD",
                status: "pending",
                userId: "user_test_1",
                providerId: "stripe"
            }
        });
        console.log("✅ Payment created:", payment.id);

        // 2. Test Customer Mapping
        const customer = await orm.customer.create({
            data: {
                id: "cus_test_1",
                userId: "user_test_1",
                providerId: "stripe",
                providerCustomerId: "cus_stripe_test_1"
            }
        });
        console.log("✅ Customer mapped:", customer.id);

        // 3. Test Retrieval
        const found = await orm.payment.findFirst({
            where: { id: "pay_test_1" }
        });
        if (found?.amount === 5000) {
            console.log("✅ Data retrieval successful.");
        } else {
            throw new Error("Data mismatch!");
        }

        console.log("\n✨ ALL TESTS PASSED! KuluPay core is ready.");
    } catch (err) {
        console.error("❌ Test failed:", err);
        process.exit(1);
    }
}

runTest();
