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
| `@kulupay/cli` | CLI tool for schema generation and database migration |

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

## Custom Schema Fields

KuluPay allows you to add custom fields to the `payment`, `customer`, and `subscription` tables without modifying the core SDK:

```typescript
export const pay = kuluPay({
  database: prisma,
  providers: [stripe({ apiKey: "sk_..." })],

  payment: {
    modelName: "payments", // rename table
    additionalFields: {
      description: { type: "string", required: false },
      receiptEmail: { type: "string", required: false },
    },
  },

  customer: {
    additionalFields: {
      country: { type: "string", required: false },
      telegramId: { type: "string", required: false, unique: true },
    },
  },

  subscription: {
    additionalFields: {
      trialEnd: { type: "datetime", required: false },
    },
  },
});
```

Supported field types: `string`, `number`, `boolean`, `datetime`, `json`.

## CLI

KuluPay provides a CLI tool for generating database schema files and migrating your database:

```bash
# Generate a Prisma schema
npx @kulupay/cli generate --generator prisma --dialect postgresql

# Generate a Drizzle schema
npx @kulupay/cli generate --generator drizzle --dialect pg

# Generate raw SQL
npx @kulupay/cli generate --generator sql --dialect postgres

# Push schema to database
npx @kulupay/cli migrate
```

### CLI Options

| Option | Description |
| --- | --- |
| `--config <path>` | Path to your KuluPay config file |
| `--output <path>` | Output file path for generated schema |
| `--generator <type>` | Schema generator: `prisma`, `drizzle`, or `sql` |
| `--dialect <type>` | Database dialect: `postgresql`, `mysql`, or `sqlite` |
| `-y, --yes` | Skip confirmation prompts |

## Testing

KuluPay uses [Vitest](https://vitest.dev/) for testing. Tests run against source files directly (no build needed).

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @kulupay/core test

# Watch mode
pnpm --filter @kulupay/core test:watch
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
