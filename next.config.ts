import type { NextConfig } from "next";

// cacheComponents is off: every page is per-user and behind auth (see docs/DECISIONS.md).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
