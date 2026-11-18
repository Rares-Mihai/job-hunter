import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    serverActions: {
      // CV uploads are accepted up to 4 MB (see src/lib/cv-pdf.ts); the
      // extra megabyte covers what the browser adds around the file.
      bodySizeLimit: "5mb",
    },
  },
  partialPrefetching: true,
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
