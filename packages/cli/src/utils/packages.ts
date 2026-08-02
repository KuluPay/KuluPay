const KULUPAY_PKG = process.env.KULUPAY_PKG || "@kulupay/kulupay";
const CORE_PKG = process.env.KULUPAY_CORE_PKG || "@kulupay/core";
const ADAPTER_SQL_PKG = process.env.KULUPAY_ADAPTER_SQL_PKG || "@kulupay/adapter-sql";
const ADAPTER_DRIZZLE_PKG = process.env.KULUPAY_ADAPTER_DRIZZLE_PKG || "@kulupay/adapter-drizzle";
const ADAPTER_PRISMA_PKG = process.env.KULUPAY_ADAPTER_PRISMA_PKG || "@kulupay/adapter-prisma";

export const PKG = {
    kulupay: KULUPAY_PKG,
    core: CORE_PKG,
    adapterSql: ADAPTER_SQL_PKG,
    adapterDrizzle: ADAPTER_DRIZZLE_PKG,
    adapterPrisma: ADAPTER_PRISMA_PKG,
} as const;
