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
    PaymentStatus,
    PaymentFilters
} from "../types";
import { ProviderError } from "../error";
import { STRIPE_ERROR_CODES } from "./stripe/error-codes";

export interface StripeOptions {
    apiKey: string;
    webhookSecret?: string;
    redirects?: {
        success: string;
        cancel: string;
    };
    /**
     * Stripe integration mode.
     * - "checkout_session": redirect-based Stripe Checkout (default when redirects are provided)
     * - "payment_intent": client-side Stripe Elements
     */
    mode?: "checkout_session" | "payment_intent";
}

// Cached Stripe client instance (per apiKey)
let stripeClientInstance: any = null;
let stripeClientApiKey: string | null = null;

const getStripeClient = async (apiKey: string) => {
    if (stripeClientInstance && stripeClientApiKey === apiKey) {
        return stripeClientInstance;
    }
    
    try {
        const StripeModule = await import('stripe');
        const Stripe = StripeModule.default;
        stripeClientInstance = new Stripe(apiKey);
        stripeClientApiKey = apiKey;
        return stripeClientInstance;
    } catch (error) {
        throw new ProviderError(
            STRIPE_ERROR_CODES.STRIPE_SDK_NOT_FOUND.message,
            "stripe"
        );
    }
};

/**
 * Maps Stripe error codes to KuluPay STRIPE_ERROR_CODES.
 * Preserves the original Stripe error in `raw`.
 */
const mapStripeError = (error: any): ProviderError => {
    const code = error?.code || error?.type || "";
    const message = error?.message || "Stripe API error";
    
    const errorMap: Record<string, { code: string; message: string }> = {
        card_declined: STRIPE_ERROR_CODES.STRIPE_CARD_DECLINED,
        insufficient_funds: STRIPE_ERROR_CODES.STRIPE_INSUFFICIENT_FUNDS,
        expired_card: STRIPE_ERROR_CODES.STRIPE_EXPIRED_CARD,
        incorrect_cvc: STRIPE_ERROR_CODES.STRIPE_INCORRECT_CVC,
        processing_error: STRIPE_ERROR_CODES.STRIPE_PROCESSING_ERROR,
        rate_limit_error: STRIPE_ERROR_CODES.STRIPE_RATE_LIMIT_ERROR,
        authentication_required: STRIPE_ERROR_CODES.STRIPE_AUTHENTICATION_REQUIRED,
    };
    
    const mapped = errorMap[code] || STRIPE_ERROR_CODES.STRIPE_API_ERROR;
    return new ProviderError(mapped.message, "stripe", error);
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
        checkout: "redirect",
        createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                const useCheckout = options.mode === "checkout_session" ||
                    (!options.mode && options.redirects);

                if (useCheckout) {
                    const session = await stripeClient.checkout.sessions.create({
                        mode: "payment",
                        success_url: options.redirects?.success || `${data.metadata?.origin ?? ""}/success`,
                        cancel_url: options.redirects?.cancel || `${data.metadata?.origin ?? ""}/cancel`,
                        line_items: [
                            {
                                price_data: {
                                    currency: data.currency,
                                    unit_amount: data.amount,
                                    product_data: {
                                        name: data.description || "Payment",
                                    },
                                },
                                quantity: 1,
                            },
                        ],
                        customer: data.customerId,
                        metadata: data.metadata,
                    });

                    return {
                        id: session.id,
                        amount: data.amount,
                        currency: data.currency,
                        status: mapStatus(session.status),
                        clientSecret: session.url,
                        redirects: options.redirects,
                        raw: session,
                        type: data.type || "one_time",
                        description: data.description,
                        providerPaymentId: session.id,
                    };
                }

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
                    type: data.type || "one_time",
                    description: data.description,
                    providerPaymentId: paymentIntent.id,
                };
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        getIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);

                if (id.startsWith("cs_")) {
                    const session = await stripeClient.checkout.sessions.retrieve(id);
                    return {
                        id: session.id,
                        amount: session.amount_total ?? 0,
                        currency: session.currency || "usd",
                        status: mapStatus(session.status),
                        clientSecret: session.url,
                        raw: session,
                        providerPaymentId: session.id,
                    };
                }

                const paymentIntent = await stripeClient.paymentIntents.retrieve(id);

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    clientSecret: paymentIntent.client_secret,
                    raw: paymentIntent,
                    providerPaymentId: paymentIntent.id,
                };
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        cancelIntent: async (id: string): Promise<PaymentIntent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const paymentIntent = await stripeClient.paymentIntents.cancel(id);

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    raw: paymentIntent,
                    providerPaymentId: paymentIntent.id,
                };
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        refund: async (id: string, amount?: number): Promise<PaymentIntent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const refund = await stripeClient.refunds.create({
                    payment_intent: id,
                    ...(amount ? { amount } : {}),
                });

                const paymentIntent = await stripeClient.paymentIntents.retrieve(id);

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    raw: { paymentIntent, refund },
                    providerPaymentId: paymentIntent.id,
                    type: "refund",
                };
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        capture: async (id: string, amount?: number): Promise<PaymentIntent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const paymentIntent = await stripeClient.paymentIntents.capture(
                    id,
                    amount ? { amount_to_capture: amount } : undefined
                );

                return {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: mapStatus(paymentIntent.status),
                    clientSecret: paymentIntent.client_secret,
                    raw: paymentIntent,
                    providerPaymentId: paymentIntent.id,
                };
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        listPayments: async (userId: string, filters?: PaymentFilters): Promise<PaymentIntent[]> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const listParams: any = {
                    limit: filters?.limit || 10,
                    ...(filters?.startDate ? { created: { gte: Math.floor(filters.startDate.getTime() / 1000) } } : {}),
                    ...(filters?.endDate ? { created: { lte: Math.floor(filters.endDate.getTime() / 1000) } } : {}),
                };
                
                const paymentIntents = await stripeClient.paymentIntents.list(listParams);
                
                return paymentIntents.data.map((pi: any) => ({
                    id: pi.id,
                    amount: pi.amount,
                    currency: pi.currency,
                    status: mapStatus(pi.status),
                    clientSecret: pi.client_secret,
                    raw: pi,
                    providerPaymentId: pi.id,
                }));
            } catch (error: any) {
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        createCustomer: async (data: CreateCustomerData): Promise<Customer> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const customer = await stripeClient.customers.create({
                    email: data.email,
                    name: data.name,
                    metadata: { ...data.metadata, userId: data.userId },
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
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        getCustomer: async (id: string): Promise<Customer> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
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
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        createSubscription: async (data: CreateSubscriptionData): Promise<Subscription> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
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
                    metadata: { ...data.metadata, userId: data.userId },
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
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        getSubscription: async (id: string): Promise<Subscription> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
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
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        cancelSubscription: async (id: string): Promise<Subscription> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
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
                if (error instanceof ProviderError) throw error;
                throw mapStripeError(error);
            }
        },
        webhookHandler: async (request: Request, ctx: KuluPayContext): Promise<WebhookEvent> => {
            try {
                const stripeClient = await getStripeClient(options.apiKey);
                
                const body = await request.text();
                const signature = request.headers.get("stripe-signature");
                
                if (!options.webhookSecret) {
                    throw new ProviderError(
                        STRIPE_ERROR_CODES.STRIPE_WEBHOOK_SECRET_MISSING.message,
                        "stripe"
                    );
                }
                if (!signature) {
                    throw new ProviderError(
                        STRIPE_ERROR_CODES.STRIPE_WEBHOOK_SIGNATURE_MISSING.message,
                        "stripe"
                    );
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
                if (error instanceof ProviderError) throw error;
                throw new ProviderError(
                    STRIPE_ERROR_CODES.STRIPE_WEBHOOK_CONSTRUCTION_FAILED.message,
                    "stripe",
                    error
                );
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
