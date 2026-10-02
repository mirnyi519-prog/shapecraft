import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // middleware буферизует тело и по умолчанию обрезает его на 10 МБ.
    // Ролик с телефона больше этого порога доходит обрезанным, и formData()
    // падает с «Failed to parse body as FormData» ещё до проверки 40 МБ.
    proxyClientMaxBodySize: "45mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "makerworld.bblmw.com",
      },
      {
        protocol: "https",
        hostname: "public-cdn.bblmw.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
