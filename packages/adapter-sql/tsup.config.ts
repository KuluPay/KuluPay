import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  external: ["pg", "mysql2", "better-sqlite3", "@farming-labs/orm-sql"],
  splitting: false,
  sourcemap: true,
  clean: true,
});
