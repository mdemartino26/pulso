# Arquitectura

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

