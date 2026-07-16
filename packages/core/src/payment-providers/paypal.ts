import { betterFetch } from "@better-fetch/fetch";
import { 
    PaymentProvider, 
    PaymentIntent, 
    CreateIntentData, 
    KuluPayContext,
    DatabaseHook,
    CreateCustomerData,
    CreateSubscriptionData,
    WebhookEvent,
    Customer,
    Subscription
} from "../types";
import { ProviderError } from "../error";

export interface PayPalOptions {
    clientId: string;
    clientSecret: string;
    mode?: "sandbox" | "live";
}

export const paypal = (options: PayPalOptions) => {
    const baseURL = options.mode === "live" 
        ? "https://api-m.paypal.com" 
        : "https://api-m.sandbox.paypal.com";

    return {
        id: "paypal",
        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            const { data: auth, error: authError } = await betterFetch<any>(`${baseURL}/v1/oauth2/token`, {
                method: "POST",
                headers: {
                    Authorization: `Basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: "grant_type=client_credentials",
            });

            if (authError) {
                throw new ProviderError("PayPal authentication failed", "paypal");
            }

            const { data: res, error } = await betterFetch<any>(`${baseURL}/v2/checkout/orders`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.access_token}`,
                },
                body: {
                    intent: "CAPTURE",
                    purchase_units: [{
                        amount: {
                            currency_code: data.currency,
                            value: (data.amount / 100).toString(),
                        }
                    }]
                },
            });

            if (error) {
                throw new ProviderError(error.message || "PayPal order creation failed", "paypal");
            }

            const approveLink = res.links.find((l: any) => l.rel === "payer-action" || l.rel === "approve");

            return {
                id: res.id,
                amount: data.amount,
                currency: data.currency,
                status: "processing",
                clientSecret: approveLink?.href
            };
        },
        getIntent: async (id: string): Promise<PaymentIntent> => {
            return {
                id,
                amount: 0,
                currency: "USD",
                status: "succeeded"
            };
        },
        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            return {
                id,
                amount: 0,
                currency: "USD",
                status: "canceled"
            };
        },
        createCustomer: async (data: CreateCustomerData): Promise<Customer> => {
            return {
                id: `paypal_${data.userId}`,
                userId: data.userId,
                providerId: "paypal",
                providerCustomerId: data.userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        getCustomer: async (id: string): Promise<Customer> => {
            return {
                id,
                userId: id.replace("paypal_", ""),
                providerId: "paypal",
                providerCustomerId: id,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        createSubscription: async (data: CreateSubscriptionData): Promise<Subscription> => {
            return {
                id: `paypal_sub_${Date.now()}`,
                userId: data.userId,
                planId: data.planId,
                status: "active",
                providerSubscriptionId: `paypal_sub_${Date.now()}`,
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                cancelAtPeriodEnd: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        cancelSubscription: async (id: string): Promise<Subscription> => {
            return {
                id,
                userId: "",
                planId: "",
                status: "canceled",
                providerSubscriptionId: id,
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        webhookHandler: async (request: Request, ctx: KuluPayContext): Promise<WebhookEvent> => {
            const body = await request.json() as any;
            return {
                type: body.event_type || "webhook",
                providerId: "paypal",
                externalId: body.id || "",
                data: body,
                timestamp: new Date(),
            };
        },
        hooks: {
            payment: {
                before: async (data: any, ctx: KuluPayContext) => {
                    return data;
                }
            } as DatabaseHook<any>
        }
    } satisfies PaymentProvider;
};
