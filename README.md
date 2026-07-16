# KuluPay

A unified payment SDK for Node.js. Integrate multiple payment providers (Stripe, PayPal, Chapa, crypto) through a single API.

## Features

- **Multi-provider support** — Stripe, PayPal, Chapa, and crypto (viem) out of the box
- **Unified API** — One interface for creating payment intents, managing customers, and handling subscriptions
- **Framework agnostic** — Works with any Node.js framework (Next.js, Express, etc.)
- **Next.js integration** — Built-in handler for Next.js App Router
- **React hooks** — Client-side hooks for payment operations
- **Type-safe** — Written in TypeScript with full type definitions
- **Pluggable** — Custom provider support via the `PaymentProvider` interface

## Packages

| Package | Description |
| --- | --- |
| `@kulupay/core` | Core logic, types, and payment provider implementations |
| `@kulupay/kulupay` | Full SDK with server handler, client, and framework integrations |

## Quick Start

### Installation

```bash
pnpm add @kulupay/kulupay
# or
npm install @kulupay/kulupay
```

### Server-side Setup

```typescript
import { kuluPay, PaymentProvider } from "@kulupay/kulupay";
import { createMemoryDriver } from "@farming-labs/orm";

const mockProvider: PaymentProvider = {
  id: "mock",
  createIntent: async (data) => ({
    id: `mock_${Date.now()}`,
    amount: data.amount,
    currency: data.currency,
    status: "pending",
    metadata: data.metadata,
  }),
  getIntent: async (id) => ({
    id,
    amount: 1000,
    currency: "USD",
    status: "succeeded",
  }),
  cancelIntent: async (id) => ({
    id,
    amount: 1000,
    currency: "USD",
    status: "canceled",
  }),
};

export const pay = kuluPay({
  database: createMemoryDriver(),
  providers: [mockProvider],
  baseURL: "http://localhost:3000/api/pay",
});
```

### Next.js Integration

```typescript
// app/api/pay/[...kulupay]/route.ts
import { toNextJsHandler } from "@kulupay/kulupay/next-js";
import { pay } from "@/lib/pay";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(pay);
```

### Client-side (React)

```typescript
import { usePayment } from "@kulupay/kulupay/client";

function Checkout() {
  const { createIntent, loading, error } = usePayment({
    baseURL: "/api/pay",
    providerId: "mock",
  });

  const handlePay = async () => {
    const intent = await createIntent({
      amount: 1000,
      currency: "USD",
      userId: "user_123",
      providerId: "mock",
    });
    console.log(intent);
  };

  return (
    <button onClick={handlePay} disabled={loading}>
      {loading ? "Processing..." : "Pay $10"}
    </button>
  );
}
```

### Client-side (Vanilla)

```typescript
import { createKuluPayClient } from "@kulupay/kulupay/client";

const client = createKuluPayClient({
  baseURL: "/api/pay",
  providerId: "mock",
});

const intent = await client.createIntent({
  amount: 1000,
  currency: "USD",
  userId: "user_123",
  providerId: "mock",
});
```

## Built-in Providers

- **Stripe** — `@kulupay/core/payment-providers`
- **PayPal** — `@kulupay/core/payment-providers`
- **Chapa** — `@kulupay/core/payment-providers`
- **Crypto (viem)** — `@kulupay/core/payment-providers`

## Custom Providers

Implement the `PaymentProvider` interface:

```typescript
import type { PaymentProvider } from "@kulupay/core";

const myProvider: PaymentProvider = {
  id: "my-provider",
  createIntent: async (data) => { /* ... */ },
  getIntent: async (id) => { /* ... */ },
  cancelIntent: async (id) => { /* ... */ },
};
```

## License

MIT
