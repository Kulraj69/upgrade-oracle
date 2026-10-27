import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cashc"],
  outputFileTracingIncludes: {
    "/api/doctor": [
      "./src/sources/bch/**/*",
      "./node_modules/cashc/**/*",
      "./node_modules/@cashscript/**/*",
      "./node_modules/@bitauth/**/*",
      "./node_modules/antlr4/**/*",
      "./node_modules/semver/**/*",
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
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
