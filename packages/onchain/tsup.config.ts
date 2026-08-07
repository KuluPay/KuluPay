import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/appkit/index.ts', 'src/react/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['react', 'react-dom', '@kulupay/core', 'viem', 'tronweb', '@reown/appkit', '@reown/appkit/react', '@reown/appkit-adapter-wagmi', '@reown/appkit-adapter-tron', '@tronweb3/tronwallet-adapter-tronlink', 'wagmi', '@wagmi/core', '@tanstack/react-query', '@better-fetch/fetch', 'nanostores'],
  splitting: false,
  sourcemap: true,
  clean: true,
});
