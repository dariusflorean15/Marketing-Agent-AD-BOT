import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared-types ships raw .ts files; Next must transpile them
  transpilePackages: ["@adbot/shared-types"],
};

export default nextConfig;
