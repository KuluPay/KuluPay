import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  external: ["drizzle-orm", "@farming-labs/orm-drizzle"],
  splitting: false,
  sourcemap: true,
  clean: true,
});
