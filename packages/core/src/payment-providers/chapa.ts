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

export interface ChapaOptions {
    secretKey: string;
    webhookSecret?: string;
}

export const chapa = (options: ChapaOptions) => {
    return {
        id: "chapa",
        checkout: "redirect",
        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            const { data: res, error } = await betterFetch<{
                status: string;
                message: string;
                data: { checkout_url: string };
            }>("https://api.chapa.co/v1/transaction/initialize", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${options.secretKey}`,
                },
                body: {
                    amount: data.amount,
                    currency: data.currency,
                    email: "test@example.com",
                    tx_ref: data.id || `tx_${Date.now()}`,
                    callback_url: "https://example.com/callback",
                },
            });

            if (error || res?.status !== "success") {
                throw new ProviderError(res?.message || "Chapa initialization failed", "chapa");
            }

            return {
                id: data.id || "chapa_intent",
                amount: data.amount,
                currency: data.currency,
                status: "pending",
                clientSecret: res.data.checkout_url
            };
        },
        getIntent: async (id: string): Promise<PaymentIntent> => {
            return {
                id,
                amount: 0,
                currency: "ETB",
                status: "succeeded"
            };
        },
        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            throw new ProviderError("Cancellation not supported by Chapa via SDK", "chapa");
        },
        createCustomer: async (data: CreateCustomerData): Promise<Customer> => {
            return {
                id: `chapa_${data.userId}`,
                userId: data.userId,
                providerId: "chapa",
                providerCustomerId: data.userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        getCustomer: async (id: string): Promise<Customer> => {
            return {
                id,
                userId: id.replace("chapa_", ""),
                providerId: "chapa",
                providerCustomerId: id,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        },
        createSubscription: async (data: CreateSubscriptionData): Promise<Subscription> => {
            return {
                id: `chapa_sub_${Date.now()}`,
                userId: data.userId,
                planId: data.planId,
                status: "active",
                providerSubscriptionId: `chapa_sub_${Date.now()}`,
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
                providerId: "chapa",
                externalId: body.tx_ref || "",
                data: body,
                timestamp: new Date(),
            };
        },
        hooks: {
            payment: {
                before: async (data: any, ctx: KuluPayContext) => {
                    data.metadata = {
                        ...data.metadata,
                        tx_ref: data.id || `tx_${Date.now()}`
                    };
                    return data;
                }
            } as DatabaseHook<any>
        }
    } satisfies PaymentProvider;
};
