import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["./packages/*"],
  },
  ssr: {
    resolve: {
      conditions: ["dev-source"],
    },
  },
});
