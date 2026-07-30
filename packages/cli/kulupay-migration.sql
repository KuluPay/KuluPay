create table if not exists "payment" (
  "id" text primary key not null,
  "userId" text not null,
  "amount" numeric(65, 30) not null,
  "currency" text not null,
  "status" text not null,
  "providerId" text not null,
  "metadata" jsonb not null,
  "type" text not null,
  "description" text,
  "customerId" text,
  "providerPaymentId" text,
  "clientSecret" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table if not exists "customer" (
  "id" text primary key not null,
  "userId" text not null unique,
  "providerId" text not null,
  "providerCustomerId" text not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table if not exists "subscription" (
  "id" text primary key not null,
  "userId" text not null,
  "planId" text not null,
  "status" text not null,
  "providerSubscriptionId" text not null unique,
  "currentPeriodEnd" timestamptz not null,
  "cancelAtPeriodEnd" boolean not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);
