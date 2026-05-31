import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: ["cloudflare-env.d.ts", ".open-next/**", "drizzle/**"] },
  ...nextVitals,
];

export default config;
