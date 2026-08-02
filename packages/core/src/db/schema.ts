import { defineSchema, model, id, string, decimal, datetime, boolean, json, belongsTo, hasMany } from "@farming-labs/orm";

const paymentFields = {
    id: id(),
    userId: string(),
    amount: decimal(),
    currency: string(),
    status: string(),
    providerId: string(),
    metadata: json(),
    type: string(),
    description: string().nullable(),
    customerId: string().nullable(),
    providerPaymentId: string().nullable(),
    clientSecret: string().nullable(),
    txHash: string().nullable(),
    createdAt: datetime(),
    updatedAt: datetime(),
};

const customerFields = {
    id: id(),
    userId: string().unique(),
    providerId: string(),
    providerCustomerId: string(),
    createdAt: datetime(),
    updatedAt: datetime(),
};

const subscriptionFields = {
    id: id(),
    userId: string(),
    planId: string(),
    status: string(),
    providerSubscriptionId: string().unique(),
    currentPeriodEnd: datetime(),
    cancelAtPeriodEnd: boolean(),
    createdAt: datetime(),
    updatedAt: datetime(),
};

export type PaymentFieldKeys = keyof typeof paymentFields;
export type CustomerFieldKeys = keyof typeof customerFields;
export type SubscriptionFieldKeys = keyof typeof subscriptionFields;

/**
 * The static base schema for KuluPay.
 * Contains the default fields for payment, customer, and subscription tables.
 * For dynamic schema generation with custom fields, use `getKuluPayTables()` instead.
 */
export const kuluPaySchema = defineSchema({
    payment: model({
        table: "payment",
        fields: paymentFields,
        constraints: {
            indexes: [
                ["userId", "status"],
                ["providerId", "providerPaymentId"],
            ],
        },
        relations: {
            customer: belongsTo("customer", { foreignKey: "customerId" }),
        },
    }),
    customer: model({
        table: "customer",
        fields: customerFields,
        relations: {
            payments: hasMany("payment", { foreignKey: "customerId" }),
            subscriptions: hasMany("subscription", { foreignKey: "userId" }),
        },
    }),
    subscription: model({
        table: "subscription",
        fields: subscriptionFields,
        constraints: {
            indexes: [
                ["userId", "status"],
            ],
        },
        relations: {
            customer: belongsTo("customer", { foreignKey: "userId" }),
        },
    })
});

export type KuluPaySchema = typeof kuluPaySchema;
