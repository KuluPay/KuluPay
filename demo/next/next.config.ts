import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@kulupay/kulupay", "@kulupay/core", "@kulupay/adapter-drizzle", "@kulupay/onchain"],
  serverExternalPackages: ["pg", "@farming-labs/orm-sql", "@farming-labs/orm", "@neondatabase/serverless", "@coinbase/cdp-sdk", "@base-org/account"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
    resolveAlias: {
      "@kulupay/onchain": "./packages/onchain/src/index.ts",
      "@kulupay/onchain/client": "./packages/onchain/src/client.ts",
      "@kulupay/onchain/appkit": "./packages/onchain/src/appkit/index.ts",
      "@kulupay/onchain/react": "./packages/onchain/src/react/index.tsx",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.conditionNames = ["dev-source", "import", "require", "default"];
    return config;
  },
};

export default nextConfig;
