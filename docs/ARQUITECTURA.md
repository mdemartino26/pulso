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

## Comidas

```
Navegador ──► /api/foods/search, /api/foods/barcode/[código]   (Route Handlers, con sesión)
          ──► Server Actions de src/features/food/actions.ts   (registrar, editar, borrar)
                 │
                 ▼
      src/server/services/food-service.ts   (lógica; no conoce Supabase ni las APIs)
         │                 │                          │
         ▼                 ▼                          ▼
   FoodProvider      repositorios (RLS)      FoodCacheWriter (clave secreta)
   USDA / OFF        food_entries, custom_foods,   foods_cache,
                     favorite_foods, rate limit    food_search_cache
```

- **Proveedores** (`src/server/food/providers`): implementan `FoodProvider` (`search`, `byBarcode`). Sumar otra base es escribir otro proveedor.
- **Caché**: búsquedas 7 días, productos 30 días. Si un proveedor no responde, se busca en la caché.
- **Unidades**: gramos o mililitros (según el alimento) y "porciones" cuando el producto declara una. Cada entrada guarda `base_per_unit` (cuántos g/ml vale 1 unidad) y los nutrientes cada 100: la base calcula el resto.
- **Rápido de cargar**: recientes, favoritos, mis alimentos, código de barras y "copiar lo del día anterior".

## Actividad

```
Server Actions de src/features/activity/actions.ts   (registrar, editar, borrar, pasos)
        │
        ▼
src/server/services/activity-service.ts   (MET, kcal, pasos incluidos, historial de fuerza)
        │                         │
        ▼                         ▼
repositorios (RLS)          profile-service.recomputeTargets
activity_entries,           (cada cambio recalcula la meta de ese día)
strength_sets, step_entries,
met_activities, exercises
```

- **Calorías**: (MET − 1) × kg × horas, con el MET de la intensidad elegida (suave, moderada, intensa) y el peso registrado más cercano a esa fecha. Se guardan con la entrada, así un día viejo no cambia si después cambia tu peso.
- **Pasos dentro de una caminata o carrera**: se estiman por cadencia (caminar 90, 105 o 120 pasos por minuto según intensidad; correr, unos 160) y se descuentan de los pasos del día. Así 30 minutos de caminata no se cuentan dos veces.
- **Meta del día**: el servicio de perfil recibe `activityLog`, que trae el ejercicio y los pasos de esa fecha. La meta de hoy en el inicio y las metas guardadas en `daily_targets` ya incluyen la actividad.
- **Fuerza**: cada serie guarda ejercicio, repeticiones y peso. El historial agrupa por sesión y muestra la mejor serie, el volumen (reps × kg) y el 1RM estimado con Epley, que sirve para comparar sesiones, no como récord real.

## Panel del día y diseño

- **Marco** (`src/components/shell`): en compu y tablet hay barra lateral; en el celular, barra de abajo con 5 secciones al alcance del pulgar. Las pantallas privadas viven en `src/app/(app)` (el grupo no cambia las URLs) y comparten ese marco.
- **Tarjetas** (`src/components/tile.tsx`): colores pastel con texto oscuro en los dos temas, título en mayúsculas, número grande y detalle chico. Ningún color significa "mal": no hay rojos.
- **Panel** (`/`): calorías y proteína, actividad, agua (+250 / +500 / deshacer), peso (tendencia de 7 días), sueño y ánimo, y hábitos para marcar con un toque.

## Agua, peso, sueño, ánimo y hábitos

`src/server/services/tracking-service.ts`, con repositorios en `tracking-repositories.ts`.

- **Agua**: cada toque es una fila; deshacer borra la última. La meta viene de las metas del día (35 ml × kg, +500 ml con ejercicio, mínimo 2 L o la que elijas en el perfil).
- **Peso**: guardar o borrar un peso recalcula las metas de ese día y las de hoy (basal, calorías, proteína y agua). El gráfico muestra cada pesaje y la tendencia (promedio de 7 días). No se puede borrar el único peso.
- **Hábitos**: en vez de rachas que se rompen, se muestra "X de los últimos 7 días" (`habitWindow` en `src/lib/calc/habits.ts`).

## Tendencias

`/tendencias?dias=7|30|90` (`src/server/services/trends-service.ts`, repositorio `trends-repositories.ts`).

- Lee solo las columnas necesarias de cada tabla para el rango, con tope de filas, y arma una serie por día (7 y 30) o por semana (90, con semanas que terminan hoy).
- **Los días sin registros no cuentan como cero**: el promedio de calorías usa solo los días con comidas, el de agua solo los días con agua, etc.
- La meta de cada día es la guardada en `daily_targets` ese día o la más cercana hacia atrás; si no hay ninguna, la actual.
- "Cerca de la meta" = dentro de ±10 %. El peso usa la tendencia de 7 días, no el pesaje suelto.
- Las frases del resumen describen y animan; nunca retan. Si la tendencia baja más rápido que el ritmo elegido, se sugiere comer un poco más.
