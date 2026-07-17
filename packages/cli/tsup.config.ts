import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  external: ['@kulupay/core', '@farming-labs/orm'],
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension: () => ({ js: '.mjs' }),
});
