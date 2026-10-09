import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/handout": ["./public/downloads/eiu-applied-agentic-ai-section-*-handout.pdf"] },
  experimental: {
    // Proxy buffers request bodies before route handlers read FormData.
    // Leave room for multipart headers around the 50 MB section-upload limit.
    proxyClientMaxBodySize: "52mb",
  },
};

export default nextConfig;
