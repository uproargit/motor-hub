import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    serverActions: {
      // Receipts, invoices and build photos are uploaded through server actions.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
