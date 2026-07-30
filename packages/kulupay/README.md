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
| `@kulupay/cli` | CLI tool for init, schema generation, and database migration |
| `@kulupay/adapter-sql` | SQL adapter for PostgreSQL, MySQL, and SQLite (via `pg`, `mysql2`, `better-sqlite3`) |
| `@kulupay/adapter-drizzle` | Drizzle ORM adapter — reuse your existing Drizzle db instance |
| `@kulupay/adapter-prisma` | Prisma adapter — reuse your existing `PrismaClient` instance |

## Quick Start

### Installation

```bash
pnpm add @kulupay/kulupay @kulupay/adapter-sql pg
# or
npm install @kulupay/kulupay @kulupay/adapter-sql pg
```

### Quick Setup with CLI

The fastest way to get started is with the CLI init command:

```bash
npx @kulupay/cli init
```

This will interactively generate:
- `lib/db.ts` — your database instance (reusable across your app)
- `lib/pay.ts` — KuluPay server config
- `lib/pay-client.ts` — KuluPay client config
- `app/api/pay/[...kulupay]/route.ts` — Next.js API route (if Next.js)
- `kulupay.json` — CLI registry file

### Server-side Setup

KuluPay is database-agnostic. You create your own database instance and pass it via an adapter.

**PostgreSQL (via `@kulupay/adapter-sql`):**

```typescript
// lib/db.ts
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});
```

```typescript
// lib/pay.ts
import { kuluPay } from "@kulupay/kulupay";
import { pg } from "@kulupay/adapter-sql";
import { pool } from "./db";

export const pay = kuluPay({
  database: pg(pool),
  providers: [],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
});
```

**Drizzle ORM (via `@kulupay/adapter-drizzle`):**

```typescript
// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));
```

```typescript
// lib/pay.ts
import { kuluPay } from "@kulupay/kulupay";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { db } from "./db";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  providers: [],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
});
```

**Prisma (via `@kulupay/adapter-prisma`):**

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

```typescript
// lib/pay.ts
import { kuluPay } from "@kulupay/kulupay";
import { prismaAdapter } from "@kulupay/adapter-prisma";
import { prisma } from "./db";

export const pay = kuluPay({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  providers: [],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
});
```

**Memory (for testing):**

```typescript
import { kuluPay } from "@kulupay/kulupay";
import { createMemoryDriver } from "@farming-labs/orm";

export const pay = kuluPay({
  database: createMemoryDriver(),
  providers: [],
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
// lib/pay-client.ts
import { createKuluPayClient } from "@kulupay/kulupay/client";

export const payClient = createKuluPayClient({
  baseURL: "/api/pay",
});
```

```typescript
import { usePaymentProvider } from "@kulupay/kulupay/client";
import { payClient } from "@/lib/pay-client";

function Checkout() {
  const { createIntent, loading, error } = usePaymentProvider({
    client: payClient,
    providerId: "stripe",
  });

  const handlePay = async () => {
    const intent = await createIntent({
      amount: 1000,
      currency: "usd",
      userId: "user_123",
      providerId: "stripe",
      productId: "prod_premium",
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
});

const intent = await client.createIntent({
  amount: 1000,
  currency: "usd",
  userId: "user_123",
  providerId: "stripe",
  productId: "prod_premium",
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

### CLI Init Options

| Option | Description |
| --- | --- |
| `--framework <name>` | Framework: `nextjs`, `express`, `hono`, `elysia` |
| `--database <type>` | Database: `memory`, `postgres`, `mysql`, `sqlite`, `prisma`, `drizzle` |
| `--baseURL <url>` | Base URL for KuluPay server |
| `--cwd <path>` | Working directory |
| `-y, --yes` | Skip prompts, use defaults |

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
