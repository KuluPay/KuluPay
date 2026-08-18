# KuluPay Implementation Progress

## Overview
KuluPay is a unified payment gateway SDK supporting multiple providers (Stripe, Chapa, PayPal, Crypto).
Architecture inspired by better-auth (server) and shadcn/ui (CLI + ejectable code ownership).

---

## Phase 1: Server-Side Hardening

### 1.1 Error Handling System (better-auth pattern) ✅
- [x] Create `defineErrorCodes` utility (type-safe error code registry, UPPER_SNAKE_CASE enforced)
- [x] Create `KULUPAY_ERROR_CODES` — core error codes (auth, provider, payment, webhook, validation, server)
- [x] Create `STRIPE_ERROR_CODES` — Stripe-specific error codes
- [x] Create `CHAPA_ERROR_CODES` — Chapa-specific error codes
- [x] Create `KuluPayAPIError` class — HTTP status + code + message + data
- [x] Refactor routes to throw `KuluPayAPIError` instead of returning `{ error, code }` with 200
- [x] Refactor client to check `res.ok` instead of `data.error`
- [x] Keep `KuluPayError`, `ProviderError`, `ValidationError` as internal errors
- [x] Provider errors should preserve original error data (Stripe error type, decline_code, etc.)

### 1.2 Auth & Authorization ✅
- [x] Add `auth` option to `KuluPayOptions` type: `{ getSession?, authorize? }`
- [x] Add `trustedOrigins` option to `KuluPayOptions` (string[] or async function)
- [x] Create `sessionMiddleware` — calls `getSession()`, throws UNAUTHORIZED if no session
- [x] Create `originCheckMiddleware` — validates Origin header against trustedOrigins (better-auth pattern)
- [x] Create `ownershipMiddleware` — checks payment.userId === session.user.id
- [x] Apply `sessionMiddleware` to: create-intent, get-intent, create-subscription, cancel-subscription
- [x] Apply `ownershipMiddleware` to: get-intent, cancel-intent, get-subscription, cancel-subscription
- [x] Do NOT apply sessionMiddleware to webhook route (uses signature verification instead)
- [x] Force `userId` from session in create-intent (ignore body.userId)
- [x] Apply `originCheckMiddleware` to all POST routes

### 1.3 Fix Stripe Provider ✅
- [x] Cache Stripe client instance
- [x] Proper error mapping — map Stripe error codes to STRIPE_ERROR_CODES
- [x] Preserve original Stripe error data in ProviderError.raw
- [x] Implement `refund` method (stripe.refunds.create)
- [x] Implement `capture` method (stripe.paymentIntents.capture)
- [x] Add `listPayments` method (stripe.paymentIntents.list with customer filter)
- [x] Fix webhook handler — use raw body (already does request.text(), good)
- [x] Map all Stripe webhook event types to normalized WebhookEvent

### 1.4 Fix Chapa Provider ✅
- [x] Implement real `getIntent` — call Chapa verify API endpoint
- [x] Implement webhook signature verification (Chapa sends hash/token)
- [x] Map Chapa statuses to KuluPay PaymentStatus
- [x] Add proper error handling with CHAPA_ERROR_CODES
- [x] Implement `refund` if Chapa supports it (likely not — mark as unsupported)

### 1.5 Add Missing Server Routes ✅
- [x] `POST /create-subscription` — create subscription (requires session)
- [x] `POST /cancel-subscription` — cancel subscription (requires session + ownership)
- [x] `GET /get-subscription` — get subscription details (requires session + ownership)
- [x] `POST /create-customer` — create provider customer (requires session)
- [x] `GET /get-customer` — get provider customer (requires session + ownership)
- [x] `POST /refund` — refund a payment (requires session + ownership)
- [x] `GET /payments` — list user's payments (requires session, filtered by userId)
- [x] All routes use `createKuluPayEndpoint` with `use: [sessionMiddleware]`

### 1.6 Webhook Improvements ✅
- [x] Map webhook event types to PaymentStatus properly
- [x] Add event deduplication (check if externalId already processed)
- [x] Add webhook event logging
- [x] Fire database hooks (before/after) on webhook events
- [x] Return proper HTTP responses (200 for success, 400 for invalid signature)

### 1.7 Database Schema Updates ✅
- [x] Add `type` field to payment table: "one_time" | "subscription_initial" | "topup" | "refund"
- [x] Add `description` field to payment table
- [x] Add `customerId` field to payment table (link to customer table)
- [x] Add `providerPaymentId` field to payment table (Stripe PaymentIntent ID, Chapa tx_ref)
- [x] Add `clientSecret` field to payment table (for client-side confirmation)
- [x] Add `txHash` field to payment table (blockchain tx hash)
- [x] Update `getKuluPayTables` to include new fields

---

## Phase 2: Client-Side Architecture

### 2.1 PaymentClientProvider Interface ✅
- [x] Define `PaymentClientProvider` interface in @kulupay/core/types
  - `id: string`
  - `confirmPayment(clientSecret, options?): Promise<PaymentIntent>`
  - `getSDK?(): Promise<any>`
  - `createElements?(options?): Promise<any>`
  - `createPaymentMethod?(data): Promise<any>`
  - `verifyPayment?(clientSecret): Promise<PaymentIntent>`
- [x] Define `PaymentConfirmOptions` type (elements, redirectUrl, redirect, confirmParams, paymentMethodData, intentId)
- [x] This interface is framework-agnostic (no React/Vue imports)

### 2.2 Client Provider Implementations (vanilla JS)
- [x] `stripe.ts` — loads @stripe/stripe-js, mounts Elements, confirms payment
- [x] `evm.ts` — EVM wallet provider (MetaMask, etc.) for crypto payments
- [x] `tron.ts` — Tron wallet provider (TronLink) for crypto payments
- [ ] `chapa-client.ts` — redirect to checkout_url, no SDK needed
- [ ] `paypal-client.ts` — loads @paypal/paypal-js, renders buttons (future)

### 2.3 Framework Bindings (thin wrappers)
- [x] `createPayClient` + `usePay` hook in react.ts — wraps KuluPayClient with nanostores
- [x] EVM/Tron provider auto-detection in react.ts
- [ ] Generic `usePaymentProvider(provider)` hook — wraps any PaymentClientProvider (not just EVM/Tron)
- [ ] Vue/Svelte bindings (future)

### 2.4 Refactor Existing Client Code
- [x] Keep `KuluPayClient` (vanilla.ts) as API transport layer — stays as-is
- [x] New `StripeClientProvider` (providers/stripe.ts) implements `PaymentClientProvider`
- [ ] Remove old `StripeReactClient` (client/stripe.ts) — replaced by `StripeClientProvider`
- [x] Update client error handling to use `KuluPayClientError` with proper status codes

---

## Phase 3: CLI + shadcn Pattern

### 3.1 Config File ✅
- [x] Create `kulupay.json` schema (like shadcn's components.json)
  - `framework`, `srcDir`, `configPath`, `clientPath`, `routePath`, `entryFile`, `baseURL`, `providers`, `database`

### 3.2 CLI Commands ✅
- [x] `npx kulupay init` — scaffold pay.ts + kulupay.json, ask which providers, setup database
- [x] `npx kulupay add-provider <name>` — add provider config, env vars, update pay.ts
- [x] `npx kulupay remove-provider <name>` — remove provider from config
- [x] `npx kulupay add <component>` — eject checkout components (React)
- [x] `npx kulupay list` — list available components
- [x] `npx kulupay generate` — generate schema (prisma/drizzle/sql)
- [x] `npx kulupay migrate` — detect DB type, generate migration guide, run commands
- [ ] `npx kulupay add block <name>` — eject pre-built flow (checkout, subscription, marketplace)
- [ ] `npx kulupay add middleware <name>` — eject middleware (auth, rate-limit)
- [ ] `npx kulupay diff` — show what's changed from registry version

### 3.3 Registry Format
- [ ] Define JSON manifest format for registry entries
- [ ] Support: provider (server), provider:client, block, middleware, binding
- [ ] Dependencies and peerDependencies tracking
- [ ] Community registry URL pattern

### 3.4 Blocks (ejectable compositions)
- [x] `checkout` block — full checkout flow (React components: checkout, wallet-picker, amount-display, countdown-timer, confirmation-status, disclosures, pay-button)
- [ ] `subscription` block — subscription management (create → cancel → change plan → webhook)
- [ ] `marketplace` block — split payments (future, Stripe Connect only)

---

## Phase 4: Polish

- [x] Comprehensive error codes enum
- [ ] Demo app (Next.js) with Stripe + Chapa side by side
- [x] Tests for middleware, error codes, schema, blockchain, CLI generate (147 tests passing)
- [ ] Tests for routes, webhooks
- [x] Documentation (Fumadocs in docs/)
- [x] TypeScript strict mode passes (all packages typecheck clean)

---

## Implementation Order

```
Phase 1.1 (error codes)  →  Phase 1.2 (auth)  →  Phase 1.3 (fix Stripe)  →
Phase 1.4 (fix Chapa)  →  Phase 1.5 (routes)  →  Phase 1.6 (webhooks)  →
Phase 1.7 (schema)  →  Phase 2 (client)  →  Phase 3 (CLI)  →  Phase 4 (polish)
```

## Current Status (Aug 2026)

Phases 1.1–1.7: **COMPLETE** ✅
Phase 2.1–2.2: Stripe/EVM/Tron client providers **DONE** ✅, Chapa client provider **PENDING**
Phase 2.3–2.4: Partially done — old StripeReactClient needs removal, generic usePaymentProvider hook pending
Phase 3.1–3.2: CLI init/add-provider/generate/migrate **DONE** ✅, blocks/middleware/diff pending
Phase 3.4: Checkout block **DONE** ✅, subscription/marketplace pending
Phase 4: Tests passing (147), typecheck clean, docs scaffolded, demo app needs verification

### Next priorities:
1. Remove old `StripeReactClient` (client/stripe.ts) — replaced by `StripeClientProvider`
2. Add Chapa client provider
3. Add route tests for API endpoints
4. Verify demo app runs

---

## Phase 5: Compliance & AML Plugin (Future)

A pluggable compliance layer for blockchain payments. KYC is the developer's responsibility; KuluPay only handles address/transaction risk screening.

### 5.1 Core API
- [ ] `ComplianceChecker` interface:
  - `screenAddress(address, chain) -> ScreeningResult`
  - `screenTransaction(txHash, chain) -> ScreeningResult`
- [ ] `RiskLevel` type: `"low" | "medium" | "high" | "severe"`
- [ ] `ScreeningResult` with `riskLevel`, `reason`, `source`, `raw`

### 5.2 Built-in Checkers
- [ ] `ofac.ts` — free OFAC/sanctions address list matcher (default)
- [ ] `chainalysis.ts` — Chainalysis API integration
- [ ] `elliptic.ts` — Elliptic API integration
- [ ] Custom checker support via `ComplianceChecker` interface

### 5.3 Integration
- [ ] Config: `compliance: { enabled, checker, blockThreshold }` in `KuluPayOptions`
- [ ] Hook into `createIntent`: screen payer address before creating intent
- [ ] Hook into `getIntent`: screen transaction hash after confirmation
- [ ] Block payments when risk >= `blockThreshold`
- [ ] Log all screenings for audit trail

### 5.4 Files
- `packages/core/src/compliance/types.ts`
- `packages/core/src/compliance/ofac.ts`
- `packages/core/src/compliance/chainalysis.ts`
- `packages/core/src/compliance/elliptic.ts`
- `packages/core/src/compliance/index.ts`

### 5.5 Continuous Monitoring & Intelligence
- [ ] Track transaction velocity and patterns per user/address over time
- [ ] Detect anomalous behavior (sudden volume, cross-border/off-ramp spikes, new devices)
- [ ] Support stablecoin off-ramp and cross-border corridor screening
- [ ] Shared data layer across KYC, AML, payment, and fraud signals
- [ ] Webhook-driven real-time monitoring after onboarding
- [ ] Device / session signals integration point (pluggable)
- [ ] Cumulative risk scoring per account (not just point-in-time checks)

### 5.6 Build vs Buy Note
- KuluPay does not build KYC; it integrates with the developer's KYC provider.
- KuluPay provides the payment + transaction monitoring hooks; specialized providers (Sumsub, Chainalysis, Elliptic, TRM) handle sanctions, fraud, and identity.

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
