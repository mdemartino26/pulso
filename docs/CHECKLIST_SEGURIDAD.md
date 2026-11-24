# Checklist de seguridad

Repaso final de los requisitos de seguridad de Pulso: qué se hizo, dónde está y cómo verificarlo. El porqué de cada decisión está en [`SEGURIDAD.md`](./SEGURIDAD.md).

**Automático** quiere decir que el CI lo chequea en cada PR y un cambio que lo rompa no se puede mergear (con la regla de rama de [`DEPLOY.md`](./DEPLOY.md#3-github-protección-del-repo)). **Manual** es algo que se configura una vez en un panel.

## En el código

| # | Requisito | Cómo se cumple | Verificación |
|---|-----------|----------------|--------------|
| 1 | **RLS en todas las tablas** con `user_id = auth.uid()` | `supabase/migrations/20261124150100_rls_y_permisos.sql`. Las tablas de referencia (actividades, ejercicios, caché de alimentos) son de solo lectura para usuarios logueados. `rate_limits` no es accesible desde el cliente. | **Automático:** job `database` (`supabase/tests/`) prueba que un usuario no ve ni modifica datos de otro y que toda tabla nueva tiene RLS. **Manual:** ninguna tabla *Unrestricted* en Supabase. |
| 2 | **La clave secreta nunca llega al navegador** | Solo la lee `src/server/supabase/admin.ts`, que importa `server-only` (el build falla si un componente de cliente lo importa). ESLint prohíbe importar `admin.ts` fuera de los dos archivos que lo necesitan (caché de alimentos y borrar cuenta). El navegador solo recibe la *publishable key*. | **Automático:** `scripts/check-client-bundle.sh` hace el build con valores "canario" y falla si aparecen en `.next/static`. |
| 3 | **Secretos en variables de entorno** | `.env.example` sin valores reales. `.gitignore` ignora todo `.env*` salvo la plantilla. Las variables se validan con Zod al arrancar (`src/lib/env.ts`, `src/lib/env.server.ts`) y los errores nombran la variable, nunca el valor. | `git ls-files \| grep env` solo muestra `.env.example`. **Manual:** *Secret scanning* y *Push protection* activados en GitHub. |
| 4 | **Mutaciones solo por Server Actions o Route Handlers**, con Zod en el servidor | `src/features/*/actions.ts` y `src/app/api/*`. Esquemas compartidos en `src/lib/validation/` con rangos razonables (por ejemplo peso 30–300 kg, agua 50–3000 ml, sueño 0–24 h). Los servicios vuelven a validar antes de escribir. | **Automático:** tests de validación y de servicios (`npm test`). |
| 5 | **Sin `dangerouslySetInnerHTML` ni SQL concatenado**; datos externos validados | Todo el acceso a datos usa el cliente de Supabase (consultas parametrizadas) o funciones SQL. Las respuestas de USDA y Open Food Facts se validan con Zod (`src/server/food/providers/`) antes de usarlas. El CSV de exportación neutraliza fórmulas (`=`, `+`, `-`, `@`). | **Automático:** ESLint (`react/no-danger`) y tests de proveedores y de CSV. |
| 6 | **Headers de seguridad** | CSP con nonce por request (`src/lib/security/csp.ts`, aplicada en `src/proxy.ts`): `connect-src 'self'`, sin `unsafe-inline` en scripts, `frame-ancestors 'none'`. HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` con `camera=(self)` y el resto apagado, COOP (`next.config.ts`). El service worker tiene su propia CSP y no cachea páginas con datos. | **Automático:** `csp.test.ts`. **Manual:** [securityheaders.com](https://securityheaders.com) da A o A+, y la consola del navegador no muestra errores de CSP. |
| 7 | **`proxy.ts` protege rutas y refresca la sesión** | Lista cerrada de rutas públicas (`src/lib/auth/routes.ts`): toda ruta nueva nace privada. Además, cada página privada llama a `requireUser()` y la base aplica RLS, así que el proxy no es la única barrera. | **Automático:** tests de rutas y de redirección (sin *open redirect*). |
| 8 | **Errores sin detalles internos** | Errores traducidos a códigos propios y textos fijos en español. `error.tsx` muestra un mensaje genérico. Los logs registran solo códigos, nunca emails, tokens ni datos de salud. | **Manual:** probar un error (por ejemplo, cortar internet) y ver que el mensaje no muestre detalles. Revisar los logs de Vercel: solo códigos. |
| 9 | **Datos mínimos** | Se guarda solo lo que hace falta para los cálculos (sin nombre real, sin dirección, sin teléfono). El usuario puede exportar todo (JSON/CSV) y borrar su cuenta, con borrado en cascada de todas sus tablas. | **Automático:** test de que la exportación cubre todas las tablas del usuario. |
| 10 | **Sesión segura** | Cookies `httpOnly`, `Secure` y `SameSite=Lax`; el navegador nunca ve los tokens. Siempre `getClaims()` (verifica la firma), nunca `getSession()` para decidir permisos. Google con PKCE. Respuestas con cookies de sesión, `Cache-Control: private, no-store`. | **Manual:** DevTools → Application → Cookies: las de `sb-` tienen *HttpOnly* y *Secure*. |
| 11 | **Límites de uso** | Búsqueda de alimentos, código de barras y exportación tienen límite por usuario, aplicado en la base (`consume_rate_limit`). | **Automático:** tests de servicios. |

## Dependencias

| # | Requisito | Cómo se cumple | Verificación |
|---|-----------|----------------|--------------|
| 12 | **npm audit** | El CI corre `npm audit --omit=dev --audit-level=high`: falla con vulnerabilidades altas o críticas en dependencias de producción. | **Automático** en cada PR y en cada push a `main`. A mano: `npm audit --omit=dev`. |
| 13 | **Dependabot** | `.github/dependabot.yml`: npm y GitHub Actions, todos los lunes. Los arreglos de seguridad llegan en un PR propio; las actualizaciones menores, agrupadas; las *major*, sueltas para revisarlas. | **Manual:** activar *Dependabot alerts* y *security updates* en GitHub. |
| 14 | **Instalaciones reproducibles** | `package-lock.json` versionado y `npm ci` en el CI. Versiones fijas en las dependencias sensibles (Next, React, lector de códigos). | **Automático.** |
| 15 | **CI con mínimo privilegio** | El workflow tiene `permissions: contents: read`: no puede escribir en el repo ni publicar nada. | Revisar `.github/workflows/ci.yml`. |

## Configuración en los paneles (una vez)

Detalle paso a paso en [`DEPLOY.md`](./DEPLOY.md).

- [ ] **Supabase:** las 5 migraciones corridas en orden y ninguna tabla *Unrestricted*.
- [ ] **Supabase:** *Confirm email* activado, contraseña mínima de 10, *Secure email/password change* activados.
- [ ] **Supabase:** *Site URL* y *Redirect URLs* exactas, sin comodines.
- [ ] **Supabase:** plantillas de mail con `token_hash`.
- [ ] **Supabase:** claves JWT asimétricas; *Exposed schemas* solo `public`.
- [ ] **Supabase:** SMTP propio antes de abrir la app a otras personas.
- [ ] **Vercel:** `SUPABASE_SECRET_KEY` y `USDA_API_KEY` marcadas como *Sensitive* y solo en *Production*.
- [ ] **Vercel:** protección de previews activada.
- [ ] **GitHub:** Dependabot alerts y security updates, Secret scanning y Push protection.
- [ ] **GitHub:** regla de rama en `main` que exige PR y los checks `check` y `database`.
- [ ] **Cuentas:** 2FA en GitHub, Vercel, Supabase y Google Cloud.

## Rutina

- **Cada semana:** revisar y mergear los PRs de Dependabot (si el CI está verde). Los de seguridad, primero.
- **Cada vez que haya una migración nueva:** correrla en Supabase, en orden, antes o junto con el deploy que la usa.
- **Si una clave se filtra** (se subió a GitHub, se pegó en un chat): rotarla enseguida en Supabase (*API Keys → Roll*) o en USDA, actualizarla en Vercel y hacer Redeploy. Borrar el commit no alcanza: la clave ya hay que darla por expuesta.
- **Antes de abrirla al público:** política de privacidad y términos de uso (datos de salud, Ley 25.326).
