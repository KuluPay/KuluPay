import { 
    PaymentProvider, 
    PaymentIntent, 
    CreateIntentData, 
    KuluPayContext,
    DatabaseHook,
    Customer,
    Subscription,
    CreateCustomerData,
    CreateSubscriptionData,
    WebhookEvent,
    PaymentStatus
} from "../types";
import { ProviderError } from "../error";

export interface StripeOptions {
    apiKey: string;
    webhookSecret?: string;
    redirects?: {
        success: string;
        cancel: string;
    };
}

// Dynamic Stripe SDK loader
let stripeInstance: any = null;

const getStripeInstance = async () => {
    if (stripeInstance) return stripeInstance;
    
    try {
        // Try to import Stripe dynamically
        const StripeModule = await import('stripe');
        stripeInstance = StripeModule.default;
        return stripeInstance;
    } catch (error) {
        throw new ProviderError(
            "Stripe SDK not found. Please install it with: npm install stripe@^20.0.0",
            "stripe"
        );
    }
};

const mapStatus = (status: string): PaymentStatus => {
    switch (status) {
        case "requires_payment_method":
        case "requires_confirmation":
        case "requires_action":
            return "pending";
        case "processing":
            return "processing";
        case "succeeded":
            return "succeeded";
        case "canceled":
            return "canceled";
        default:
            return "failed";
    }
};

export const stripe = (options: StripeOptions) => {
    return {
        id: "stripe",
        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const paymentIntent = await stripeClient.paymentIntents.create({
                    amount: data.amount,
                    currency: data.currency,
                    description: data.description,
                    metadata: data.metadata,
                    customer: data.customerId,
                    automatic_payment_methods: {
                        enabled: true,
                    },
                });

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    clientSecret: paymentIntent.client_secret,
                    redirects: options.redirects,
                    raw: paymentIntent,
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe initialization failed", "stripe");
            }
        },
        getIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const paymentIntent = await stripeClient.paymentIntents.retrieve(id);

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    clientSecret: paymentIntent.client_secret,
                    raw: paymentIntent,
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe retrieval failed", "stripe");
            }
        },
        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const paymentIntent = await stripeClient.paymentIntents.cancel(id);

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    raw: paymentIntent,
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe cancellation failed", "stripe");
            }
        },
        createCustomer: async (data: CreateCustomerData): Promise<Customer> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const customer = await stripeClient.customers.create({
                    email: data.email,
                    name: data.name,
                    metadata: data.metadata,
                });

                return {
                    id: customer.id,
                    userId: data.userId,
                    providerId: "stripe",
                    providerCustomerId: customer.id,
                    createdAt: new Date(customer.created * 1000),
                    updatedAt: new Date(),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe customer creation failed", "stripe");
            }
        },
        getCustomer: async (id: string): Promise<Customer> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const customer = await stripeClient.customers.retrieve(id);

                return {
                    id: customer.id,
                    userId: (customer as any).metadata?.userId || "",
                    providerId: "stripe",
                    providerCustomerId: customer.id,
                    createdAt: new Date((customer as any).created * 1000),
                    updatedAt: new Date(),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe customer retrieval failed", "stripe");
            }
        },
        createSubscription: async (data: CreateSubscriptionData): Promise<Subscription> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const subscription = await stripeClient.subscriptions.create({
                    customer: data.customerId,
                    items: [{ price: data.planId }],
                    payment_settings: {
                        payment_method_types: ["card"],
                        payment_method_options: {
                            card: {
                                request_three_d_secure: "automatic",
                            },
                        },
                    },
                    metadata: data.metadata,
                });

                return {
                    id: subscription.id,
                    userId: data.userId,
                    planId: data.planId,
                    status: subscription.status as any,
                    providerSubscriptionId: subscription.id,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    createdAt: new Date(subscription.created * 1000),
                    updatedAt: new Date(),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe subscription creation failed", "stripe");
            }
        },
        getSubscription: async (id: string): Promise<Subscription> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const subscription = await stripeClient.subscriptions.retrieve(id);

                return {
                    id: subscription.id,
                    userId: (subscription as any).metadata?.userId || "",
                    planId: (subscription as any).items?.data?.[0]?.price?.id || "",
                    status: subscription.status as any,
                    providerSubscriptionId: subscription.id,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    createdAt: new Date(subscription.created * 1000),
                    updatedAt: new Date(),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe subscription retrieval failed", "stripe");
            }
        },
        cancelSubscription: async (id: string): Promise<Subscription> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const subscription = await stripeClient.subscriptions.cancel(id);

                return {
                    id: subscription.id,
                    userId: (subscription as any).metadata?.userId || "",
                    planId: (subscription as any).items?.data?.[0]?.price?.id || "",
                    status: subscription.status as any,
                    providerSubscriptionId: subscription.id,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    createdAt: new Date(subscription.created * 1000),
                    updatedAt: new Date(),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe subscription cancellation failed", "stripe");
            }
        },
        webhookHandler: async (request: Request, ctx: KuluPayContext): Promise<WebhookEvent> => {
            try {
                const Stripe = await getStripeInstance();
                const stripeClient = new Stripe(options.apiKey);
                
                const body = await request.text();
                const signature = request.headers.get("stripe-signature");
                
                if (!options.webhookSecret || !signature) {
                    throw new ProviderError("Webhook secret or signature missing", "stripe");
                }
                
                const event = stripeClient.webhooks.constructEvent(
                    body,
                    signature,
                    options.webhookSecret
                );
                
                return {
                    type: event.type,
                    providerId: "stripe",
                    externalId: event.id,
                    data: event.data.object as any,
                    timestamp: new Date(event.created * 1000),
                };
            } catch (error: any) {
                throw new ProviderError(error.message || "Stripe webhook verification failed", "stripe");
            }
        },
        hooks: {
            payment: {
                before: async (data: any, ctx: KuluPayContext) => {
                    const customer = await ctx.orm.customer.findFirst({
                        where: { userId: data.userId, providerId: "stripe" }
                    });

                    if (customer) {
                        data.customerId = customer.providerCustomerId;
                    }
                    return data;
                }
            } as DatabaseHook<any>,
            customer: {
                after: async (data: any, ctx: KuluPayContext) => {
                    // Logic after customer created
                }
            } as DatabaseHook<any>
        }
    } satisfies PaymentProvider;
};
