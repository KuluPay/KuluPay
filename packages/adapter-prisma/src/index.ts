import { createPrismaDriver } from "@farming-labs/orm-prisma";

export interface PrismaAdapterOptions {
  provider: "postgresql" | "mysql" | "sqlite";
}

/**
 * Prisma ORM adapter for KuluPay.
 *
 * Reuses an existing Prisma Client so you don't create a second database connection.
 *
 * @example
 * ```ts
 * import { kuluPay } from "@kulupay/core";
 * import { prismaAdapter } from "@kulupay/adapter-prisma";
 * import { prisma } from "./db"; // your existing Prisma client
 *
 * const pay = kuluPay({
 *   database: prismaAdapter(prisma, { provider: "postgresql" }),
 *   providers: [...],
 * });
 * ```
 */
export function prismaAdapter<Client = any>(
  client: Client,
  options: PrismaAdapterOptions,
) {
  return createPrismaDriver({
    client,
    provider: options.provider,
  });
}

export { createPrismaDriver } from "@farming-labs/orm-prisma";
