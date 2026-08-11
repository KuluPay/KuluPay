# KuluPay

A unified payment SDK for Node.js. Accept payments via Stripe, PayPal, Chapa, and onchain crypto (EVM + Tron) through a single API.

## Features

- **Multi-provider support** — Stripe, PayPal, Chapa, and onchain crypto (Ethereum, Base, Polygon, Arbitrum, Tron)
- **Onchain payments** — Accept USDC, USDT, DAI, and native tokens with wallet-based checkout via AppKit
- **On-chain verification** — Server verifies actual transaction recipient, amount, and confirmation status
- **Unified API** — One interface for creating payment intents, managing customers, and handling subscriptions
- **Framework agnostic** — Works with any Node.js framework (Next.js, Express, Hono, etc.)
- **Next.js integration** — Built-in handler for Next.js App Router
- **React hooks** — Client-side hooks for payment operations and onchain checkout flow
- **Type-safe** — Written in TypeScript with full type definitions
- **Pluggable** — Custom provider support via the `PaymentProvider` interface or KuluPay plugins

## Packages

| Package | Description |
| --- | --- |
| `@kulupay/core` | Core logic, types, and payment provider implementations |
| `@kulupay/kulupay` | Full SDK with server handler, client, and framework integrations |
| `@kulupay/onchain` | Onchain payment plugin — EVM + Tron support with AppKit wallet integration |
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

## Onchain Payments

Accept crypto payments on EVM chains (Ethereum, Base, Polygon, Arbitrum) and Tron with wallet-based checkout.

### Installation

```bash
pnpm add @kulupay/onchain viem tronweb
```

### Server-side Setup

```typescript
// lib/pay.ts
import { kuluPay } from "@kulupay/kulupay";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { onchain } from "@kulupay/onchain";
import { db } from "./db";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    onchain({
      ethereum: {
        recipientAddress: "0xYourAddress",
        tokens: ["USDC", "USDT", "native"],
        testnet: false, // mainnet
      },
      base: {
        recipientAddress: "0xYourAddress",
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      polygon: {
        recipientAddress: "0xYourAddress",
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      arbitrum: {
        recipientAddress: "0xYourAddress",
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      tron: {
        recipientAddress: "TYourAddress",
        tokens: ["USDT"],
        testnet: false,
        apiKey: "your-trongrid-api-key", // optional, for higher rate limits
      },
    }),
  ],
  baseURL: "http://localhost:3000",
  checkoutUrl: "/checkout?intentId={intentId}&clientSecret={clientSecret}",
});
```

### Testnet Support

Set `testnet: true` to use the default testnet for each chain, or specify a testnet by name:

```typescript
onchain({
  ethereum: {
    recipientAddress: "0xYourAddress",
    tokens: ["USDC"],
    testnet: "sepolia", // or just true for default
  },
  tron: {
    recipientAddress: "TYourAddress",
    tokens: ["USDT"],
    testnet: "nile", // or "shasta", or just true
  },
})
```

| Chain | Default Testnet | Testnets Available |
| --- | --- | --- |
| Ethereum | sepolia | sepolia |
| Base | base-sepolia | base-sepolia |
| Polygon | amoy | amoy |
| Arbitrum | arbitrum-sepolia | arbitrum-sepolia |
| Tron | nile | nile, shasta |

### Client-side Setup

```typescript
// lib/pay-client.ts
import { createPayClient } from "@kulupay/kulupay/client";
import { onchainClient } from "@kulupay/onchain/client";

export const payClient = createPayClient({
  baseURL: "http://localhost:3000",
  plugins: [
    onchainClient({
      walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
      debug: true,
    }),
  ],
});
```

### Checkout UI (React)

```tsx
"use client";
import { useKuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { KuluPayConnectButton } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";

function Checkout({ intentId, clientSecret }: { intentId: string; clientSecret: string }) {
  const { intent, status, error, txHash, connected, address, connect, pay } = useKuluPayCheckout({
    client: payClient,
    intentId,
    clientSecret,
    onSuccess: (txHash) => console.log("Payment complete:", txHash),
    onError: (err) => console.error("Payment failed:", err),
  });

  if (status === "success") {
    return <p>Payment complete! Tx: {txHash}</p>;
  }

  return (
    <div>
      {connected ? (
        <button onClick={pay} disabled={status === "sending" || status === "confirming"}>
          {status === "sending" ? "Waiting for wallet..." :
           status === "confirming" ? "Confirming on-chain..." :
           `Pay ${intent?.amount}`}
        </button>
      ) : (
        <KuluPayConnectButton
          chains={intent?.chainConfig ? [intent.chainConfig] : []}
          label="Connect wallet"
        />
      )}
      {error && <p>{error}</p>}
    </div>
  );
}
```

### Checkout Flow

1. **Create intent** — Server creates a payment intent with the token, amount, and recipient
2. **Connect wallet** — User connects their wallet (MetaMask, TronLink, etc.) via AppKit
3. **Sign transaction** — User signs the transaction in their wallet; client broadcasts it
4. **Confirm with server** — Client sends the txHash to `/confirm-intent`
5. **Poll for confirmation** — Client polls `/verify-intent` every 3 seconds
6. **On-chain verification** — Server verifies the actual on-chain recipient and amount match the intent
7. **Success** — Server marks the payment as `succeeded` once confirmed on-chain

### Supported Tokens

| Token | Chains | Decimals |
| --- | --- | --- |
| USDC | Ethereum, Base, Polygon, Arbitrum | 6 |
| USDT | Ethereum, Base, Polygon, Arbitrum, Tron | 6 |
| DAI | Ethereum, Base, Polygon, Arbitrum | 18 |
| ETH (native) | Ethereum, Base, Polygon, Arbitrum | 18 |
| TRX (native) | Tron | 6 |
| MATIC (native) | Polygon | 18 |

Use `"native"` in the tokens array to accept the chain's native token.

### Onchain Configuration Options

| Option | Type | Description |
| --- | --- | --- |
| `recipientAddress` | `string` | Wallet address to receive payments |
| `tokens` | `string \| string[]` | Token symbols to accept (e.g. `["USDC", "USDT", "native"]`) |
| `testnet` | `boolean \| string` | `false` for mainnet, `true` for default testnet, or testnet name |
| `network` | `Partial<NetworkConfig>` | Custom network override (chainId, rpcUrl, etc.) |
| `priceConverter` | `PriceConverter` | Custom fiat-to-crypto converter (defaults to stablecoin 1:1) |
| `confirmations` | `number` | Required block confirmations (default: 1, EVM only) |
| `apiKey` | `string` | TronGrid API key for higher rate limits (Tron only) |

### Onchain Error Handling

The onchain plugin provides typed errors with user-friendly messages and hints:

```typescript
import { OnchainError, ONCHAIN_ERROR_CODES } from "@kulupay/onchain";

try {
  await payClient.onchain.sendPayment(intent);
} catch (err) {
  if (err instanceof OnchainError) {
    console.log(err.code);        // "WRONG_CHAIN"
    console.log(err.message);     // "Wrong network."
    console.log(err.hint);        // "Switch to the correct network in your wallet."
    console.log(err.developerMessage); // Detailed dev info
  }
}
```

| Error Code | Description |
| --- | --- |
| `WALLET_NOT_FOUND` | No wallet extension detected |
| `WALLET_NOT_CONNECTED` | Wallet not connected |
| `TRANSACTION_REJECTED` | User rejected the transaction |
| `INSUFFICIENT_FUNDS` | Not enough balance for tx + gas |
| `WRONG_CHAIN` | Wallet on wrong network |
| `CHAIN_NOT_ADDED` | Chain not in wallet |
| `TRANSACTION_FAILED` | Transaction reverted on-chain |
| `RPC_ERROR` | Network communication error |
| `MISSING_PAYMENT_DATA` | Payment intent data missing |

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
