import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  external: ["@prisma/client", "@farming-labs/orm-prisma"],
  splitting: false,
  sourcemap: true,
  clean: true,
});
