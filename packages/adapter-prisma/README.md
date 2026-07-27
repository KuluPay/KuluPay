# @kulupay/adapter-prisma

Prisma adapter for KuluPay.

## Install

```bash
npm install @kulupay/adapter-prisma @prisma/client
```

## Usage

```ts
import { kuluPay } from "@kulupay/kulupay";
import { prismaAdapter } from "@kulupay/adapter-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const pay = kuluPay({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  providers: [],
});
```

## Options

- `provider`: `"postgresql"` | `"mysql"` | `"sqlite"`
