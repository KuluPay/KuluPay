import { pgTable, text, boolean, numeric, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const payment = pgTable("payment", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  amount: numeric("amount", { precision: 65, scale: 30 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  providerId: text("providerId").notNull(),
  metadata: jsonb("metadata").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  customerId: text("customerId"),
  providerPaymentId: text("providerPaymentId"),
  clientSecret: text("clientSecret"),
  txHash: text("txHash"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull()
}, (table) => ({
  paymentUseridStatusIdx: index("payment_userid_status_idx").on(table.userId, table.status),
  paymentProvideridProviderpaymentidIdx: index("payment_providerid_providerpaymentid_idx").on(table.providerId, table.providerPaymentId)
}));

export const customer = pgTable("customer", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique(),
  providerId: text("providerId").notNull(),
  providerCustomerId: text("providerCustomerId").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull()
});

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  planId: text("planId").notNull(),
  status: text("status").notNull(),
  providerSubscriptionId: text("providerSubscriptionId").notNull().unique(),
  currentPeriodEnd: timestamp("currentPeriodEnd", { withTimezone: true, mode: "date" }).notNull(),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull()
}, (table) => ({
  subscriptionUseridStatusIdx: index("subscription_userid_status_idx").on(table.userId, table.status)
}));

export const paymentRelations = relations(payment, ({ one, many }) => ({
  customer: one(customer, { fields: [payment.customerId], references: [customer.id] })
}));

export const customerRelations = relations(customer, ({ one, many }) => ({
  payments: many(payment),
  subscriptions: many(subscription)
}));

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  customer: one(customer, { fields: [subscription.userId], references: [customer.id] })
}));
