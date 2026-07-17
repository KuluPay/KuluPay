import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kulupay/kulupay"],
  serverExternalPackages: ["pg", "@farming-labs/orm-sql", "@farming-labs/orm", "@neondatabase/serverless"],
};

export default nextConfig;
