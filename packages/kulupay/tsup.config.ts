import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts', 'src/client/appkit/index.ts', 'src/client/providers/index.ts', 'src/integrations/appkit-react.tsx', 'src/integrations/next-js.ts', 'src/api/index.ts', 'src/payment-providers/index.ts', 'src/payment-providers/stripe.ts', 'src/payment-providers/chapa.ts', 'src/payment-providers/paypal.ts', 'src/payment-providers/onchain.ts', 'src/checkout/index.ts', 'src/checkout/react/index.tsx', 'src/checkout/vue/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['react', 'react-dom', 'vue', '@stripe/stripe-js', '@kulupay/core', 'viem', 'tronweb', '@reown/appkit', '@reown/appkit/react', '@reown/appkit-adapter-wagmi', '@reown/appkit-adapter-tron', '@tronweb3/tronwallet-adapter-tronlink', 'wagmi', '@wagmi/core', '@tanstack/react-query', '@better-fetch/fetch'],
  splitting: false,
  sourcemap: true,
  clean: true,
});
