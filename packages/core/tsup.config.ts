import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/api/index.ts",
    "src/async_hooks/index.ts",
    "src/context/index.ts",
    "src/db/index.ts",
    "src/error/index.ts",
    "src/payment-providers/index.ts",
    "src/payment-providers/stripe.ts",
    "src/payment-providers/chapa.ts",
    "src/payment-providers/paypal.ts",
    "src/utils/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["pg", "@farming-labs/orm-sql", "@neondatabase/serverless"],
});
