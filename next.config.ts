import type { NextConfig } from "next";

// The browser calls the API through this same-origin proxy, so the FastAPI
// CORS config (which currently omits PUT/DELETE) does not block requests.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
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
