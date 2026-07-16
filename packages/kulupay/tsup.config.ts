import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts', 'src/integrations/next-js.ts', 'src/api/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['react', 'react-dom', '@stripe/stripe-js', '@kulupay/core'],
  splitting: false,
  sourcemap: true,
  clean: true,
});
