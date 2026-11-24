# Seguridad: decisiones de diseño

Registro de las decisiones de seguridad de Pulso y su porqué. Se suma una sección por etapa.

## Etapa 1: headers, CSP y PWA

**Content-Security-Policy con nonce** (`src/proxy.ts`, `src/lib/security/csp.ts`)
- En cada request se genera un nonce aleatorio de 128 bits. Solo ejecutan los scripts que lo tienen (los de Next.js) y los que esos scripts cargan (`'strict-dynamic'`). Un script inyectado por XSS no tiene el nonce, así que el navegador no lo ejecuta.
- `connect-src` solo permite nuestra app y Supabase. USDA y Open Food Facts **no** están: el navegador nunca les habla directo, pasa por nuestros Route Handlers (así la API key de USDA no sale del servidor y podemos limitar el uso por usuario).
- `img-src` permite `images.openfoodfacts.org` para las fotos de productos.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- Costo: todas las páginas se renderizan en cada request. Por eso Cache Components / PPR quedan desactivados (generan HTML estático sin nonce). En una app con login esto no cambia nada.
- En desarrollo se permite `'unsafe-eval'` (React lo usa para mostrar errores) y estilos inline (hot reload). En producción no.
- `style-src-attr 'unsafe-inline'`: permite atributos `style="..."` (los usan `next/image` y Recharts). Un atributo de estilo no puede ejecutar JavaScript; el riesgo es bajo y aceptado.

**Compatibilidad con el service worker** (`public/sw.js`)
- Con `'strict-dynamic'` el navegador ignora `'self'` en `script-src`, y eso bloquearía el registro del service worker. Por eso se declara `worker-src 'self'` aparte.
- El service worker **no cachea HTML**: cada página trae un nonce nuevo en su CSP; si se sirviera una página cacheada, se reutilizaría un nonce viejo (y además mostraría datos de salud guardados en el dispositivo). Las navegaciones van siempre a la red y, sin conexión, se muestra `offline.html`.
- Solo cachea archivos públicos e inmutables (`/_next/static`, íconos). En un celular compartido no queda ningún dato personal en caché.
- No intercepta POST (Server Actions), `/api` ni otros dominios.
- `sw.js` y `offline.html` tienen su propia CSP fija y mínima (`next.config.ts`).

**Otros headers** (`next.config.ts`)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`: fuerza HTTPS por 2 años. Sin `preload` por ahora, porque salir de esa lista tarda meses; conviene sumarlo cuando tengas dominio propio definitivo.
- `X-Frame-Options: DENY` (clickjacking, para navegadores viejos), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: `camera=(self)` para el escáner de códigos de barras; micrófono, ubicación, pagos, sensores, etc. apagados.
- `Cross-Origin-Opener-Policy: same-origin` y sin `X-Powered-By`.
- Las páginas salen con `Cache-Control: private, no-store` (lo pone Next en páginas dinámicas): ningún proxy o CDN guarda datos de salud.
- `robots: noindex`: los buscadores no indexan la app.

**Secretos**
- `.env*` está en `.gitignore` (salvo `.env.example`, que no tiene valores reales).
- `src/lib/env.server.ts` importa `server-only`: si un componente de cliente lo importa por error, el build falla.

**Cadena de suministro**
- Dependabot activado por archivo; CI corre `npm audit --omit=dev --audit-level=high` en cada PR.
- El workflow de CI tiene permisos de solo lectura.
