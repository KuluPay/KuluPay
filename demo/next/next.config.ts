import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kulupay/kulupay", "@kulupay/core", "@kulupay/adapter-drizzle", "@kulupay/onchain"],
  serverExternalPackages: ["pg", "@farming-labs/orm-sql", "@farming-labs/orm", "@neondatabase/serverless", "@coinbase/cdp-sdk", "@base-org/account"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
