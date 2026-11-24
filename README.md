# Pulso

**Pulso** es una app web para acompañar tu estilo de vida día a día. Registrás tus comidas, tu actividad, tu peso, el agua que tomás, tu sueño, tu ánimo y tus hábitos, y ves tu balance del día y cómo vas en el tiempo.

Está pensada para ayudar a sostener un déficit calórico **de forma saludable**: con metas que respetan límites seguros, un tono positivo y sin culpa, y tendencias por encima de los días sueltos.

## Qué podés hacer

- **Panel del día:** meta de calorías, lo consumido, lo quemado, agua, peso, sueño, ánimo y hábitos, de un vistazo.
- **Comidas:** buscar alimentos genéricos (USDA) y productos envasados de Argentina (Open Food Facts), o escanear el código de barras con la cámara.
- **Actividad:** gimnasio, deportes y pasos, con calorías estimadas por MET y el progreso de fuerza por ejercicio.
- **Peso:** registro y tendencia semanal (promedio de 7 días), que importa más que el número de un día.
- **Agua, sueño, ánimo y hábitos:** carga rápida, con hábitos que cuentan "X de los últimos 7 días" en lugar de rachas que castigan un día malo.
- **Tendencias:** 7, 30 o 90 días de calorías, actividad, peso y sueño.
- **Tus datos:** exportar todo en JSON o CSV, y borrar la cuenta cuando quieras.

Se instala en el celular como una app (PWA) y tiene modo claro y oscuro.

## Privacidad y seguridad

Tus datos de salud son tuyos. Cada usuario solo puede ver sus propios registros (Row Level Security en todas las tablas), la sesión vive en cookies que JavaScript no puede leer y el navegador solo habla con la propia app. Se guarda lo mínimo necesario, y podés exportar o borrar toda tu información.

Detalle en [`docs/SEGURIDAD.md`](./docs/SEGURIDAD.md) y repaso final en [`docs/CHECKLIST_SEGURIDAD.md`](./docs/CHECKLIST_SEGURIDAD.md).

## Tecnología

- **Next.js 16** (App Router, Server Actions) con TypeScript estricto.
- **Supabase**: Postgres, Auth (email y Google) y RLS.
- **Tailwind CSS** + shadcn/ui, **Recharts** para los gráficos.
- **Zod** para validar en el cliente y en el servidor.
- **Vitest** para los tests; el CI de GitHub también prueba las políticas RLS en un Postgres limpio.
- Hosting en **Vercel** + **Supabase**.

## Correrla en tu compu

Necesitás Node.js 22 o más (recomendado 24).

```bash
git clone https://github.com/mdemartino26/pulso.git
cd pulso
npm ci
cp .env.example .env.local   # completá los valores (ver comentarios del archivo)
npm run dev                  # http://localhost:3000
```

La base se crea corriendo los archivos de `supabase/migrations/` en orden en el SQL Editor de Supabase. Los pasos completos, también para el login, están en [`docs/DEPLOY.md`](./docs/DEPLOY.md).

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | App en modo desarrollo |
| `npm run check` | Lint + tipos + tests, antes de cada PR |
| `npm run build` y `npm start` | Versión de producción en local |
| `npm audit --omit=dev` | Busca vulnerabilidades conocidas en las dependencias |

`.env.local` nunca se sube a GitHub. La clave secreta de Supabase (`SUPABASE_SECRET_KEY`) es solo para el servidor: nunca con prefijo `NEXT_PUBLIC_`.

## Publicarla

Vercel + Supabase, paso a paso: [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Documentación

- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md): capas, carpetas y cómo agregar funciones.
- [`docs/MODELO_DE_DATOS.md`](./docs/MODELO_DE_DATOS.md): tablas y relaciones.
- [`docs/SEGURIDAD.md`](./docs/SEGURIDAD.md): decisiones de seguridad, etapa por etapa.
- [`docs/CHECKLIST_SEGURIDAD.md`](./docs/CHECKLIST_SEGURIDAD.md): checklist final.
- [`docs/DEPLOY.md`](./docs/DEPLOY.md): deploy en Vercel + Supabase.

## Estado

MVP completo. La Fase 2 (ajuste automático del gasto, foto de comida con IA, recetas, medidas, Apple Health / Health Connect, recordatorios) tiene la arquitectura preparada, sin implementar: ver [`docs/MODELO_DE_DATOS.md`](./docs/MODELO_DE_DATOS.md#fase-2-cómo-se-suma-sin-romper-nada).

> Pulso no reemplaza la consulta con profesionales de la salud. Las metas son estimaciones.
