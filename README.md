# Pulso

App web (PWA) de seguimiento de estilo de vida: comidas, actividad, peso, agua y hábitos, con foco en sostener un déficit calórico de forma saludable.

> Estado: **Etapa 1 de 10** (estructura, setup, PWA base y headers de seguridad). El README completo (Supabase, Google OAuth, USDA, deploy) llega en la Etapa 10.

## Stack

| Pieza | Versión | Notas |
| --- | --- | --- |
| Next.js (App Router) | 16.4.6 | En v16 `middleware.ts` pasó a llamarse **`proxy.ts`** y corre en Node.js |
| React | 19.3 | |
| TypeScript | 5, modo estricto | + `noUncheckedIndexedAccess` |
| Tailwind CSS | 4.3 | Configuración en CSS (`globals.css`), sin `tailwind.config` |
| shadcn/ui | estilo new-york | Los componentes se copian a `src/components/ui` |
| @supabase/ssr | 0.12.7 | Con @supabase/supabase-js 2.119 |
| Zod | 4 | Esquemas compartidos cliente/servidor |
| Recharts | 3 | |
| Vitest | 5 | |

## Requisitos

- Node.js 22 o superior (recomendado 24, el mismo que usa Vercel por defecto).
- npm 10 o superior.

## Cómo se creó (referencia)

No hace falta repetir esto: ya está todo en el repo. Lo dejo para que sepas de dónde sale cada cosa.

```bash
npx create-next-app@16.4.6 pulso --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd pulso
npm i @supabase/ssr@0.12.7 @supabase/supabase-js zod recharts next-themes server-only \
      clsx tailwind-merge class-variance-authority lucide-react radix-ui
npm i -D vitest @types/node@24 tw-animate-css
```

shadcn/ui ya está configurado (`components.json`, `src/lib/utils.ts`, tokens en `globals.css`). Para sumar componentes:

```bash
npx shadcn@latest add card input label dialog sheet tabs progress
```

## Correr en local

```bash
git clone https://github.com/mdemartino26/pulso.git
cd pulso
npm ci                      # instala exactamente lo del package-lock
cp .env.example .env.local  # y completá los valores (ver abajo)
npm run dev                 # http://localhost:3000
```

Otros comandos:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript sin emitir archivos
npm test            # Vitest
npm run check       # los tres anteriores juntos
npm run build && npm start   # build de producción (el service worker solo se registra acá)
```

## Variables de entorno

Ver [`.env.example`](./.env.example). Resumen:

| Variable | ¿Pública? | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Clave publishable (la ex "anon key"). Es pública por diseño; los datos los protege RLS |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL de la app (redirecciones de login) |
| `SUPABASE_SECRET_KEY` | **No** | Clave secreta (ex "service_role"). Saltea RLS. Solo en `src/server/supabase/admin.ts` |
| `USDA_API_KEY` | **No** | API de USDA FoodData Central. Solo en Route Handlers |

Las variables se validan con Zod al usarlas (`src/lib/env.ts` y `src/lib/env.server.ts`). Si falta alguna, el error dice **qué** variable falta, nunca su valor.

> Supabase renombró las claves: "anon" ahora es **publishable** (`sb_publishable_...`) y "service_role" ahora es **secret** (`sb_secret_...`). Funcionan igual, pero las nuevas se pueden rotar sin cortar la app.

## Estructura de carpetas

```
pulso/
├── .github/
│   ├── dependabot.yml          # actualizaciones automáticas de dependencias
│   └── workflows/ci.yml        # lint + typecheck + tests + npm audit + build en cada PR
├── public/
│   ├── sw.js                   # service worker (no cachea HTML ni datos)
│   ├── offline.html/.css       # pantalla sin conexión, estática y sin scripts
│   └── icons/                  # íconos de la PWA (192, 512, maskable, apple)
├── supabase/
│   └── migrations/             # SQL versionado (Etapa 2)
├── src/
│   ├── proxy.ts                # CSP con nonce (+ sesión y rutas privadas en la Etapa 3)
│   ├── app/                    # rutas de Next.js (App Router)
│   │   ├── layout.tsx
│   │   ├── manifest.ts         # manifest de la PWA
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # componentes de shadcn/ui
│   │   └── pwa/                # registro del service worker
│   ├── features/               # UI por dominio: comidas, actividad, peso, agua, hábitos…
│   ├── lib/
│   │   ├── calc/               # funciones puras de cálculo (BMR, gasto, metas…) + tests
│   │   ├── validation/         # esquemas Zod compartidos cliente/servidor
│   │   ├── security/           # CSP (y luego rate limiting)
│   │   ├── env.ts              # variables públicas validadas
│   │   └── env.server.ts       # variables secretas (import "server-only")
│   └── server/                 # código que SOLO corre en el servidor
│       ├── supabase/           # clientes de Supabase (server, admin)
│       ├── repositories/       # acceso a datos: la única capa que habla con Supabase
│       ├── services/           # lógica de negocio (usa repositorios + lib/calc)
│       └── food-providers/     # interfaz FoodProvider: USDA, Open Food Facts, …
└── .env.example
```

La regla de dependencias es: `app` y `features` → `server/services` → `server/repositories` → Supabase. La UI nunca importa Supabase directamente, y `lib/calc` no depende de nada (ni UI ni base de datos).

## Decisiones de seguridad (Etapa 1)

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
