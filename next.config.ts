import type { NextConfig } from "next";

// T-009: cabeceras de seguridad básicas. La app se sirve solo bajo su propio
// origen (nunca embebida en un iframe de terceros), así que X-Frame-Options
// bloquea clickjacking sobre /login sin afectar ninguna funcionalidad legítima.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
