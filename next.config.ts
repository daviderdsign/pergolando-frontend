import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image (one container per tenant).
  output: "standalone",
  async redirects(){return [
    {source:'/wizard',destination:'/progetto',permanent:false},
    {source:'/demo/catalogo/preventivo',destination:'/cataloghi/preventivo',permanent:false},
    {source:'/demo/catalogo',destination:'/cataloghi/importa',permanent:false},
    {source:'/prova',destination:'/progetto',permanent:false},
  ];},
  // Local phone testing: the dev server is reachable at the PC's LAN/
  // Tailscale IP, but Next.js blocks cross-origin dev requests (including
  // the HMR websocket) from any host other than localhost by default —
  // without this, hydration breaks silently and forms fall back to native
  // (non-JS) submission. Dev-only, has no effect on `next build`/`next start`.
  allowedDevOrigins: ["pergolando.rdsign-app.it","192.168.1.118", "192.168.0.117", "100.83.13.118"],
};

export default nextConfig;
