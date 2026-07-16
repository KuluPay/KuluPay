import { kuluPay,  paypal, chapa, createKuluPayClient } from "@kulupay/kulupay";
import { createMemoryDriver } from "@farming-labs/orm";

async function main() {
    // 1. Initialize KuluPay with Farming ORM (Memory Driver) and all Providers
    console.log("--- Initializing KuluPay with Consolidated Providers ---");
    const pay = kuluPay({
        database: createMemoryDriver(),
        providers: [
            // stripe({ 
            //     apiKey: process.env.STRIPE_API_KEY as string,
            //     redirects: {
            //         success: "http://localhost:3000/success",
            //         cancel: "http://localhost:3000/cancel"
            //     }
            // })
             
            paypal({
                clientId: "paypal_id",
                clientSecret: "paypal_secret",
                mode: "sandbox"
            }),
            chapa({
                secretKey: "chapa_key"
            })
        ],
        debug: true
    });

    // 2. Initialize KuluPay Client
    const payClient = createKuluPayClient({
        baseURL: "http://localhost:3000/api/pay"
    });

    // 3. Test Stripe Intent
    console.log("\n--- Testing Stripe Intent ---");
    try {
        const stripeIntent = await pay.api.createIntent({
            amount: 2500,
            currency: "USD",
            providerId: "stripe",
            userId: "user_1"
        });
        console.log("Stripe Status:", stripeIntent.status);
    } catch (e) {
        console.log("Stripe Test (Expectedly) failed or skipped due to mock keys");
    }

    // 4. Test PayPal Intent
    console.log("\n--- Testing PayPal Intent ---");
    try {
        const paypalIntent = await pay.api.createIntent({
            amount: 5000,
            currency: "USD",
            providerId: "paypal",
            userId: "user_2"
        });
        console.log("PayPal Status:", paypalIntent.status);
    } catch (e) {
        console.log("PayPal Test (Expectedly) failed or skipped due to mock keys");
    }

    // 5. Test Chapa Intent
    console.log("\n--- Testing Chapa Intent ---");
    try {
        const chapaIntent = await pay.api.createIntent({
            amount: 1500,
            currency: "ETB",
            providerId: "chapa",
            userId: "user_3"
        });
        console.log("Chapa Status:", chapaIntent.status);
    } catch (e) {
        console.log("Chapa Test (Expectedly) failed or skipped due to mock keys");
    }
}

main().catch(console.error);
