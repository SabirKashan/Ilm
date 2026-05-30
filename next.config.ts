import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

// next-pwa uses webpack; we skip it and handle the manifest manually
// PWA functionality: manifest.json + service worker added manually in a future session
export default nextConfig;
