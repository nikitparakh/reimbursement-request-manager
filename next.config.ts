import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "pdf-lib"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
