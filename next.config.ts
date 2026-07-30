import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["./src/**/*.test.ts", "./src/lib/fixtures/**/*"],
  },
};

export default nextConfig;
