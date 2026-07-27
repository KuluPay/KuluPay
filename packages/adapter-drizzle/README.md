# @kulupay/adapter-drizzle

Drizzle ORM adapter for KuluPay.

## Install

```bash
npm install @kulupay/adapter-drizzle drizzle-orm
```

## Usage

```ts
import { kuluPay } from "@kulupay/kulupay";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  providers: [],
});
```

## Options

- `provider`: `"pg"` | `"mysql"` | `"sqlite"`
