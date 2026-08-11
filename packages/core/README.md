# @kulupay/core

Core logic, types, and payment provider implementations for KuluPay.

## Features

- **Multi-provider support** — Stripe, PayPal, Chapa, and onchain crypto (EVM + Tron)
- **Unified provider interface** — Implement `PaymentProvider` to add any payment method
- **Plugin system** — Extend KuluPay with plugins like `@kulupay/onchain`
- **Type-safe** — Full TypeScript type definitions for all APIs
- **Framework agnostic** — Core logic works with any Node.js framework
- **Database agnostic** — Works with PostgreSQL, MySQL, SQLite, Drizzle, Prisma, or memory

## Packages

| Package | Description |
| --- | --- |
| `@kulupay/core` | Core logic, types, and payment provider implementations |
| `@kulupay/kulupay` | Full SDK with server handler, client, and framework integrations |
| `@kulupay/onchain` | Onchain payment plugin — EVM + Tron support with AppKit wallet integration |
| `@kulupay/cli` | CLI tool for project init, schema generation, and database migration |
| `@kulupay/adapter-sql` | SQL adapter for PostgreSQL, MySQL, and SQLite |
| `@kulupay/adapter-drizzle` | Drizzle ORM adapter |
| `@kulupay/adapter-prisma` | Prisma adapter |

## Quick Start

### Installation

```bash
pnpm add @kulupay/kulupay
# or
npm install @kulupay/kulupay
```

### Server-side Setup

```typescript
import { kuluPay, PaymentProvider, createMemoryDriver } from "@kulupay/kulupay";

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
import { usePaymentProvider } from "@kulupay/kulupay/client";

function Checkout() {
  const { createIntent, loading, error } = usePaymentProvider({
    client: payClient,
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
import { createPayClient } from "@kulupay/kulupay/client";

const client = createPayClient({
  baseURL: "/api/pay",
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
- **Onchain (EVM + Tron)** — `@kulupay/onchain`

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

KuluPay provides a CLI tool for project initialization, schema generation, and database migration:

```bash
# Initialize KuluPay in your project (interactive)
npx @kulupay/cli init

# Initialize with flags (non-interactive)
npx @kulupay/cli init --framework nextjs --database drizzle --yes

# Generate schema
npx @kulupay/cli generate --generator drizzle

# Push schema to database
npx @kulupay/cli migrate

# Add a payment provider
npx @kulupay/cli add-provider stripe
```

### Database Adapters

| Database | Adapter Package | Driver Dependency |
| --- | --- | --- |
| PostgreSQL | `@kulupay/adapter-sql` | `pg` |
| MySQL | `@kulupay/adapter-sql` | `mysql2` |
| SQLite | `@kulupay/adapter-sql` | `better-sqlite3` |
| Drizzle ORM | `@kulupay/adapter-drizzle` | `drizzle-orm` + driver |
| Prisma | `@kulupay/adapter-prisma` | `@prisma/client` |
| Memory | `@farming-labs/orm` | (none, for testing) |

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
