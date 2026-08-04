import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@kulupay/kulupay", "@kulupay/core", "@kulupay/adapter-drizzle"],
  serverExternalPackages: ["pg", "@farming-labs/orm-sql", "@farming-labs/orm", "@neondatabase/serverless"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.conditionNames = ["dev-source", "import", "require", "default"];
    return config;
  },
};

export default nextConfig;
