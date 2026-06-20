import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native modules out of the bundler; load them at runtime in Node.
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
