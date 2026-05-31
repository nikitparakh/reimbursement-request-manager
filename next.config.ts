import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "pdf-lib"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;

// Enables the OpenNext Cloudflare adapter during `next dev` so that
// `getCloudflareContext()` (D1, R2, Queue bindings) is available locally.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
