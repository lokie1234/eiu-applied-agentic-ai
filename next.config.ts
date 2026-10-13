import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/downloads/eiu-advertising-starter.zip",
      headers: [{ key: "Content-Disposition", value: 'attachment; filename="eiu-advertising-starter.zip"' }],
    }];
  },
  outputFileTracingIncludes: {
    "/api/sections/*/content": ["./course-content/**/*.tsx"],
    "/api/handout": ["./public/downloads/eiu-applied-agentic-ai-section-*-handout.pdf"],
    "/api/admin/drive/export": ["./lib/drive/builtin-decks/*.tsx.txt", "./course-content/**/*.tsx"],
  },
  experimental: {
    // Proxy buffers request bodies before route handlers read FormData.
    // Leave room for multipart headers around the 50 MB section-upload limit.
    proxyClientMaxBodySize: "52mb",
  },
};

export default nextConfig;
