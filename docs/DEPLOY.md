# Deploy: Vercel + Supabase

Guía para publicar Pulso con los planes gratuitos de Vercel y Supabase. Se hace una vez; después, cada merge a `main` se publica solo.

Orden recomendado: primero Supabase (base y login), después Vercel (la app) y al final volver a Supabase para cargar la URL definitiva.

---

## 1. Supabase: el proyecto de producción

Si ya tenés un proyecto que usaste para probar en local, podés usar ese. Para uso comercial conviene uno nuevo, solo para producción, así los datos de prueba no se mezclan con los reales.

1. En [supabase.com](https://supabase.com), **New project**. Región **South America (São Paulo)**. Guardá la contraseña de la base en un gestor de contraseñas.
2. **SQL Editor → New query**: pegá y ejecutá (**Run**) cada archivo de `supabase/migrations/`, **uno por vez y en este orden**:

   | # | Archivo | Qué hace |
   |---|---------|----------|
   | 1 | `20261124150000_esquema_inicial.sql` | Tablas, índices y funciones |
   | 2 | `20261124150100_rls_y_permisos.sql` | RLS en todas las tablas y permisos |
   | 3 | `20261124150200_datos_de_referencia.sql` | Actividades (MET) y ejercicios |
   | 4 | `20261124190000_permisos_cache_servidor.sql` | Permiso de la clave secreta sobre la caché de alimentos |
   | 5 | `20261124200000_limite_exportar.sql` | Límite de uso para exportar datos |

   Regla general: cada archivo nuevo que aparezca en `supabase/migrations/` se corre **una vez, en orden**.
3. **Chequeo:** en **Table Editor** no tiene que haber ninguna tabla con la etiqueta **Unrestricted**. Si aparece, esa tabla no tiene RLS: no publiques hasta resolverlo.
4. **Project Settings → JWT Keys:** que use **claves asimétricas** (los proyectos nuevos ya vienen así).
5. **Project Settings → Data API:** en *Exposed schemas* dejá solo `public` (y `graphql_public` si viene por defecto).

### Login (Authentication)

6. **Sign In / Providers → Email**
   - **Confirm email:** activado.
   - **Minimum password length:** 10 (el mismo mínimo que valida la app).
   - **Secure email change** y **Secure password change:** activados.
   - **Leaked password protection** (si tu plan lo ofrece): activado. Rechaza contraseñas que aparecieron en filtraciones.
7. **Emails → Templates:** reemplazá el `href` del link por:
   - **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - **Reset password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/restablecer-contrasena`
8. **Google** (Sign In / Providers → Google): pegá el *Client ID* y el *Client secret* de Google Cloud. En Google Cloud, en **Authorized redirect URIs**, va la URL que te muestra esa misma pantalla de Supabase (`https://TU-PROYECTO.supabase.co/auth/v1/callback`). El secret de Google vive solo en Supabase: no va en Vercel ni en el código.
9. **Mails de verdad (recomendado antes de abrirla a otras personas):** el servidor de mail que trae Supabase gratis manda muy pocos mails por hora y es solo para pruebas. En **Authentication → Emails → SMTP Settings** cargá un proveedor (por ejemplo Resend o Brevo, que tienen plan gratis).

Las URLs (paso 12) se completan cuando ya tengas la dirección de Vercel.

### Claves que vas a necesitar

En **Project Settings → API Keys**:
- **Publishable key** (`sb_publishable_...`): pública, va al navegador. Lo que protege los datos es RLS.
- **Secret key** (`sb_secret_...`): **secreta**. Saltea RLS. Solo la usa el servidor en `src/server/supabase/admin.ts`, para guardar la caché de alimentos y para borrar la cuenta. Nunca con prefijo `NEXT_PUBLIC_`, nunca en un chat o un mail.

---

## 2. Vercel: la app

10. En [vercel.com](https://vercel.com), **Add New → Project** e importá el repo `pulso` de GitHub. Vercel detecta Next.js solo; no cambies los comandos de build.
11. Antes de tocar **Deploy**, en **Environment Variables** cargá:

    | Variable | Valor | Entorno | ¿Secreta? |
    |----------|-------|---------|-----------|
    | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase | Production | No |
    | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key | Production | No |
    | `NEXT_PUBLIC_SITE_URL` | `https://TU-APP.vercel.app` (sin `/` al final) | Production | No |
    | `SUPABASE_SECRET_KEY` | Secret key | Production | **Sí**: marcala como *Sensitive* |
    | `USDA_API_KEY` | Tu clave de USDA | Production | **Sí**: marcala como *Sensitive* |

    - *Sensitive* hace que Vercel no muestre el valor nunca más, ni a vos: si alguien entra a tu cuenta, no puede leerla.
    - Si todavía no sabés la URL final, poné la que te sugiere Vercel (`nombre-del-proyecto.vercel.app`) y corregila después del primer deploy. Cada vez que cambies una variable, hacé **Redeploy** para que se aplique.
    - **No cargues** `USDA_API_BASE_URL`, `OFF_API_BASE_URL` ni `OFF_SEARCH_BASE_URL`: son solo para tests.

12. **Deploy.** Cuando termine, copiá la URL y volvé a Supabase, **Authentication → URL Configuration**:
    - **Site URL:** `https://TU-APP.vercel.app`
    - **Redirect URLs:** `https://TU-APP.vercel.app/auth/callback` y `https://TU-APP.vercel.app/auth/confirm`. Si seguís probando en tu compu, dejá también las de `http://localhost:3000`.

    Usá URLs exactas, sin comodines (`*`): un comodín permitiría que un link de login mande la sesión a otra dirección.

### Ajustes de Vercel recomendados

13. **Settings → Functions → Function Region:** `São Paulo (gru1)`, la misma zona que Supabase. Cada pedido a la base viaja menos y la app responde más rápido.
14. **Previews de los PRs.** Las variables quedaron solo en *Production*, así que los previews no tienen acceso a la base de producción (bien: un PR no puede tocar datos reales). Para que no aparezcan como fallidos, en **Settings → Git → Ignored Build Step** elegí **Only build production**. El CI de GitHub ya prueba cada PR. Si más adelante querés previews que funcionen, creá un segundo proyecto de Supabase solo para eso y cargá sus claves en el entorno *Preview*.
15. **Settings → Deployment Protection:** dejá activada la protección de los previews (*Vercel Authentication*), que viene por defecto.
16. **Cuenta de Vercel y de Supabase:** activá la verificación en dos pasos (2FA) en las dos. Quien entra a esas cuentas tiene acceso a todo.

### Dominio propio (opcional)

17. **Settings → Domains → Add**, y seguí los pasos de DNS que te da Vercel. El certificado HTTPS es automático.
18. Después cambiá la URL en los tres lugares: `NEXT_PUBLIC_SITE_URL` en Vercel (y Redeploy), **Site URL** y **Redirect URLs** en Supabase.
19. La app ya manda `Strict-Transport-Security` (HTTPS obligatorio por 2 años). Cuando el dominio sea definitivo, podés sumar `preload` en `next.config.ts` y anotarlo en [hstspreload.org](https://hstspreload.org). Ojo: salir de esa lista tarda meses, por eso no viene activado.

---

## 3. GitHub: protección del repo

20. **Settings → Code security:** activá **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** y **Push protection** (este último frena un `git push` que contenga una clave).
21. **Settings → Branches → Add rule** para `main`: *Require a pull request before merging* y *Require status checks to pass* con los checks `check` y `database`. Así nada llega a producción sin pasar el CI.

---

## 4. Verificar que quedó bien

Después del primer deploy, en el celular y en la compu:

- [ ] Crear una cuenta con email: llega el mail, el link abre la app y entra.
- [ ] "Olvidé mi contraseña": llega el mail y permite cambiarla.
- [ ] Entrar con Google.
- [ ] Completar el perfil, cargar una comida buscándola y otra escaneando el código de barras (la cámara necesita HTTPS: ahora sí funciona en el celular).
- [ ] Cargar actividad, agua, peso y un hábito; ver el panel y Tendencias.
- [ ] Instalar la app desde el navegador del celular ("Agregar a pantalla de inicio").
- [ ] Exportar los datos en JSON y CSV.
- [ ] Headers: en [securityheaders.com](https://securityheaders.com) poné tu URL. Tiene que dar **A** o **A+**.
- [ ] En Chrome, DevTools → Console: ningún error de *Content Security Policy*.
- [ ] Abrir `https://TU-APP.vercel.app/` sin sesión: tiene que mandarte al login.

---

## 5. Cosas a saber de los planes gratuitos

- **Supabase pausa el proyecto si no se usa durante una semana.** Se reactiva desde el panel, sin perder datos. Para uso comercial, el plan Pro lo evita.
- **El plan gratis de Supabase no tiene backups restaurables por vos.** Hasta pasar a Pro, exportá tus datos de vez en cuando (Perfil → Tus datos) o hacé un backup con `pg_dump`.
- **Vercel Hobby es para uso personal, no comercial.** Cuando Pulso empiece a cobrar o tenga usuarios reales, hay que pasar a Vercel Pro.
- **Datos de salud de terceros:** antes de abrirla al público hacen falta una política de privacidad y términos de uso (Ley 25.326 de Protección de Datos Personales en Argentina).

## Si algo falla

| Qué pasa | Qué revisar |
|----------|-------------|
| El build de Vercel falla con "Variables de entorno … inválidas" | Falta una variable o tiene un formato inválido. El mensaje dice cuál (nunca el valor). |
| El link del mail abre `localhost` | La **Site URL** de Supabase sigue apuntando a local. |
| "redirect_uri_mismatch" al entrar con Google | En Google Cloud falta la URL de callback de Supabase. |
| Volvés al login después de entrar con Google | Falta `https://TU-APP.vercel.app/auth/callback` en **Redirect URLs** de Supabase. |
| "Algo no salió como esperábamos" al buscar alimentos | Falta la migración 4 o `SUPABASE_SECRET_KEY` no empieza con `sb_secret_`. Los logs de Vercel (**Logs**) muestran el código de error, sin datos personales. |
| No funciona exportar | Falta la migración 5. |
