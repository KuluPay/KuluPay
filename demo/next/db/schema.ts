import { pgTable, text, boolean, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull()
});

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
});
