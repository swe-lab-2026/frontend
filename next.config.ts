import type { NextConfig } from "next";

// The browser calls the API through this same-origin proxy, so the FastAPI
// CORS config (which currently omits PUT/DELETE) does not block requests.
// Read while building: a built image keeps the address it was built with.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone for the Docker image. Only there:
  // `next start` does not support it.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
