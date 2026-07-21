# KuluPay Implementation Progress

## Overview
KuluPay is a unified payment gateway SDK supporting multiple providers (Stripe, Chapa, PayPal, Crypto).
Architecture inspired by better-auth (server) and shadcn/ui (CLI + ejectable code ownership).

---

## Phase 1: Server-Side Hardening

### 1.1 Error Handling System (better-auth pattern)
- [ ] Create `defineErrorCodes` utility (type-safe error code registry, UPPER_SNAKE_CASE enforced)
- [ ] Create `KULUPAY_ERROR_CODES` — core error codes (auth, provider, payment, webhook, validation, server)
- [ ] Create `STRIPE_ERROR_CODES` — Stripe-specific error codes
- [ ] Create `CHAPA_ERROR_CODES` — Chapa-specific error codes
- [ ] Create `KuluPayAPIError` class — HTTP status + code + message + data
- [ ] Refactor routes to throw `KuluPayAPIError` instead of returning `{ error, code }` with 200
- [ ] Refactor client to check `res.ok` instead of `data.error`
- [ ] Keep `KuluPayError`, `ProviderError`, `ValidationError` as internal errors
- [ ] Provider errors should preserve original error data (Stripe error type, decline_code, etc.)

### 1.2 Auth & Authorization
- [ ] Add `auth` option to `KuluPayOptions` type: `{ getSession?, authorize? }`
- [ ] Add `trustedOrigins` option to `KuluPayOptions` (string[] or async function)
- [ ] Create `sessionMiddleware` — calls `getSession()`, throws UNAUTHORIZED if no session
- [ ] Create `originCheckMiddleware` — validates Origin header against trustedOrigins (better-auth pattern)
- [ ] Create `ownershipMiddleware` — checks payment.userId === session.user.id
- [ ] Apply `sessionMiddleware` to: create-intent, get-intent, create-subscription, cancel-subscription
- [ ] Apply `ownershipMiddleware` to: get-intent, cancel-intent, get-subscription, cancel-subscription
- [ ] Do NOT apply sessionMiddleware to webhook route (uses signature verification instead)
- [ ] Force `userId` from session in create-intent (ignore body.userId)
- [ ] Apply `originCheckMiddleware` to all POST routes

### 1.3 Fix Stripe Provider
- [ ] Cache Stripe client instance (currently creates `new Stripe()` on every method call)
- [ ] Proper error mapping — map Stripe error codes to STRIPE_ERROR_CODES
- [ ] Preserve original Stripe error data in ProviderError.raw
- [ ] Implement `refund` method (stripe.refunds.create)
- [ ] Implement `capture` method (stripe.paymentIntents.capture)
- [ ] Add `listPayments` method (stripe.paymentIntents.list with customer filter)
- [ ] Fix webhook handler — use raw body (already does request.text(), good)
- [ ] Map all Stripe webhook event types to normalized WebhookEvent

### 1.4 Fix Chapa Provider
- [ ] Implement real `getIntent` — call Chapa verify API endpoint
- [ ] Implement webhook signature verification (Chapa sends hash/token)
- [ ] Map Chapa statuses to KuluPay PaymentStatus
- [ ] Add proper error handling with CHAPA_ERROR_CODES
- [ ] Implement `refund` if Chapa supports it (likely not — mark as unsupported)

### 1.5 Add Missing Server Routes
- [ ] `POST /create-subscription` — create subscription (requires session)
- [ ] `POST /cancel-subscription` — cancel subscription (requires session + ownership)
- [ ] `GET /get-subscription` — get subscription details (requires session + ownership)
- [ ] `POST /create-customer` — create provider customer (requires session)
- [ ] `GET /get-customer` — get provider customer (requires session + ownership)
- [ ] `POST /refund` — refund a payment (requires session + ownership)
- [ ] `GET /payments` — list user's payments (requires session, filtered by userId)
- [ ] All routes use `createKuluPayEndpoint` with `use: [sessionMiddleware]`

### 1.6 Webhook Improvements
- [ ] Map webhook event types to PaymentStatus properly
- [ ] Add event deduplication (check if externalId already processed)
- [ ] Add webhook event logging
- [ ] Fire database hooks (before/after) on webhook events
- [ ] Return proper HTTP responses (200 for success, 400 for invalid signature)

### 1.7 Database Schema Updates
- [ ] Add `type` field to payment table: "one_time" | "subscription_initial" | "topup" | "refund"
- [ ] Add `description` field to payment table
- [ ] Add `customerId` field to payment table (link to customer table)
- [ ] Add `providerPaymentId` field to payment table (Stripe PaymentIntent ID, Chapa tx_ref)
- [ ] Add `clientSecret` field to payment table (for client-side confirmation)
- [ ] Update `getKuluPayTables` to include new fields

---

## Phase 2: Client-Side Architecture

### 2.1 PaymentClientProvider Interface
- [ ] Define `PaymentClientProvider` interface in @kulupay/core/types
  - `id: string`
  - `init(options): Promise<void>` — load SDK if needed
  - `pay(intent, options?): Promise<PaymentResult>` — execute payment flow
  - `render?(container, intent, options?): void` — render provider UI (Stripe Elements, PayPal buttons)
  - `destroy?(): void` — cleanup
- [ ] Define `PaymentClientInitOptions`, `PayOptions`, `PaymentResult` types
- [ ] This interface is framework-agnostic (no React/Vue imports)

### 2.2 Client Provider Implementations (vanilla JS)
- [ ] `stripe-client.ts` — loads @stripe/stripe-js, mounts Elements, confirms payment
- [ ] `chapa-client.ts` — redirect to checkout_url, no SDK needed
- [ ] `paypal-client.ts` — loads @paypal/paypal-js, renders buttons (future)

### 2.3 Framework Bindings (thin wrappers)
- [ ] `usePaymentProvider(provider)` — React hook, wraps any PaymentClientProvider
- [ ] Same hook works for all providers (only calls interface methods)
- [ ] Vue/Svelte bindings (future)

### 2.4 Refactor Existing Client Code
- [ ] Keep `KuluPayClient` (vanilla.ts) as API transport layer — stays as-is
- [ ] Remove `StripeReactClient` (stripe.ts) — replaced by ejectable stripe-client.ts + usePaymentProvider
- [ ] Refactor `react.ts` — generic `usePaymentProvider` hook, not provider-specific
- [ ] Update client error handling to use `KuluPayClientError` with proper status codes

---

## Phase 3: CLI + shadcn Pattern

### 3.1 Config File
- [ ] Create `kulupay.json` schema (like shadcn's components.json)
  - `aliases`: { providers, blocks, middleware }
  - `registry`: URL for community providers
  - `style`: "default" | "minimal"

### 3.2 CLI Commands
- [ ] `npx @kulupay/cli init` — scaffold pay.ts + kulupay.json, ask which providers, setup database
- [ ] `npx @kulupay/cli add provider <name>` — eject server provider into user's project
- [ ] `npx @kulupay/cli add provider <name> --client` — eject client provider
- [ ] `npx @kulupay/cli add block <name>` — eject pre-built flow (checkout, subscription, marketplace)
- [ ] `npx @kulupay/cli add middleware <name>` — eject middleware (auth, rate-limit)
- [ ] `npx @kulupay/cli diff` — show what's changed from registry version
- [ ] Keep existing: `generate` and `migrate` commands

### 3.3 Registry Format
- [ ] Define JSON manifest format for registry entries
- [ ] Support: provider (server), provider:client, block, middleware, binding
- [ ] Dependencies and peerDependencies tracking
- [ ] Community registry URL pattern

### 3.4 Blocks (ejectable compositions)
- [ ] `checkout` block — full checkout flow (create intent → render UI → poll → redirect)
- [ ] `subscription` block — subscription management (create → cancel → change plan → webhook)
- [ ] `marketplace` block — split payments (future, Stripe Connect only)

---

## Phase 4: Polish

- [ ] Comprehensive error codes enum
- [ ] Demo app (Next.js) with Stripe + Chapa side by side
- [ ] Tests for providers, routes, webhooks, middleware
- [ ] Documentation
- [ ] TypeScript strict mode passes

---

## Implementation Order

```
Phase 1.1 (error codes)  →  Phase 1.2 (auth)  →  Phase 1.3 (fix Stripe)  →
Phase 1.4 (fix Chapa)  →  Phase 1.5 (routes)  →  Phase 1.6 (webhooks)  →
Phase 1.7 (schema)  →  Phase 2 (client)  →  Phase 3 (CLI)  →  Phase 4 (polish)
```

Starting with Stripe provider first (Phase 1.3) after error codes (1.1) and auth (1.2).

---

## Key Architecture Decisions

1. **Server providers are framework-agnostic** — use standard Request/Response, no Next.js/Express imports
2. **Client providers are framework-agnostic** — vanilla JS, no React/Vue imports
3. **Framework bindings are thin wrappers** — only wrap vanilla provider into hooks/components
4. **One-time payment = createIntent** — it's core, not a block. Every provider implements it.
5. **Blocks are compositions** — checkout, subscription, marketplace. Optional, ejectable.
6. **Error handling follows better-auth** — defineErrorCodes + APIError with HTTP status
7. **Auth is pluggable** — user provides getSession(), KuluPay doesn't hardcode better-auth
8. **CLI follows shadcn pattern** — you own the code, eject providers/blocks/middleware
9. **userId comes from session, never from request body**
10. **Webhooks use signature verification, not session auth**
