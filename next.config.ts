import type { NextConfig } from "next";

/**
 * Headers de seguridad que NO dependen del request (la CSP con nonce
 * se arma en src/proxy.ts porque cambia en cada request).
 */
const securityHeaders = [
  // HTTPS obligatorio por 2 años. Sin "preload" todavía: salir de la lista
  // de preload tarda meses, conviene agregarlo cuando el dominio sea fijo.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Nadie puede embeber la app en un iframe (clickjacking). Redundante con
  // frame-ancestors 'none', pero cubre navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  // El navegador no "adivina" tipos MIME (evita ejecutar un JSON como script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A otros sitios solo les llega el origen, nunca la ruta (que puede tener fechas, ids).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Cámara solo para nuestro propio origen (escáner); todo lo demás apagado.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "hid=()",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "display-capture=()",
      "browsing-topics=()",
    ].join(", "),
  },
  // Aísla la ventana de popups de otros orígenes.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // No anunciar "X-Powered-By: Next.js".
  poweredByHeader: false,
  // La CSP con nonce exige render dinámico: Cache Components / PPR
  // generan un shell estático sin nonce, así que quedan desactivados.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // El service worker se revisa en cada carga para que las
        // actualizaciones lleguen enseguida, y tiene su propia CSP mínima.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // Página offline estática: sin scripts, sin formularios.
        source: "/offline.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
