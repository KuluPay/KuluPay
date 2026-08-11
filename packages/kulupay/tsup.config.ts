import { defineConfig } from 'tsup';

const isDev = process.env.KULUPAY_DEV === '1';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts', 'src/client/appkit/index.ts', 'src/client/providers/index.ts', 'src/integrations/appkit-react.tsx', 'src/integrations/next-js.ts', 'src/api/index.ts', 'src/payment-providers/index.ts', 'src/payment-providers/stripe.ts', 'src/payment-providers/chapa.ts', 'src/payment-providers/paypal.ts', 'src/payment-providers/onchain.ts', 'src/checkout/index.ts', 'src/checkout/react/index.tsx', 'src/plugins/onchain.ts', 'src/plugins/onchain/client.ts', 'src/plugins/onchain/appkit.ts', 'src/plugins/onchain/react.tsx'],
  format: isDev ? ['esm'] : ['cjs', 'esm'],
  dts: !isDev,
  external: ['react', 'react-dom', '@stripe/stripe-js', '@kulupay/core', '@kulupay/onchain', 'viem', 'tronweb', 'zod', '@reown/appkit', '@reown/appkit/react', '@reown/appkit-adapter-wagmi', '@reown/appkit-adapter-tron', '@tronweb3/tronwallet-adapter-tronlink', '@tronweb3/tronwallet-adapter-okxwallet', '@tronweb3/tronwallet-adapter-bitkeep', '@tronweb3/tronwallet-adapter-tokenpocket', '@tronweb3/tronwallet-adapter-bybit', '@tronweb3/tronwallet-adapter-trust', 'wagmi', '@wagmi/core', '@tanstack/react-query', '@better-fetch/fetch'],
  splitting: false,
  sourcemap: !isDev,
  clean: true,
});
