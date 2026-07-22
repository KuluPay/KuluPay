import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  external: ['@kulupay/core', '@farming-labs/orm'],
  sourcemap: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
});
