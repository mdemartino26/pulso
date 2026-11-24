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


## Cálculos (`src/lib/calc`)

Funciones puras, sin fecha "de hoy" implícita, testeadas con Vitest.

- **Metabolismo basal**: Mifflin-St Jeor (+5 varones, −161 mujeres).
- **Gasto del día** = basal × factor de actividad (1,2 / 1,375 / 1,55 / 1,725) + ejercicio + pasos extra.
- **Ejercicio**: (MET − 1) × kg × horas. Se resta 1 MET porque el basal ya está contado.
- **Pasos**: solo cuentan los pasos *por encima* de lo que ya incluye tu nivel de actividad (sedentario 4.000, ligero 6.000, moderado 8.000, alto 10.000). Si no, se contarían dos veces. Los pasos durante una caminata o carrera registrada como ejercicio tampoco se suman.
- **Meta** = gasto − déficit (7.700 kcal por kg), con piso de 1.200 kcal (mujeres) o 1.500 kcal (varones) y ritmo máximo del 1 % del peso por semana.
- **Proteína**: 1,6–2,2 g/kg en déficit.
- **Agua**: 35 ml × kg, +500 ml los días con ejercicio, mínimo 2 L (editable).
- Las metas de cada día se guardan en `daily_targets`: si cambiás el peso, los días anteriores no cambian.
