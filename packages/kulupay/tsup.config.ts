import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts', 'src/client/stripe.ts', 'src/client/providers/index.ts', 'src/integrations/next-js.ts', 'src/api/index.ts', 'src/payment-providers/index.ts', 'src/payment-providers/stripe.ts', 'src/payment-providers/chapa.ts', 'src/payment-providers/paypal.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['react', 'react-dom', '@stripe/stripe-js', '@kulupay/core'],
  splitting: false,
  sourcemap: true,
  clean: true,
});
