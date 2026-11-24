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

## Etapa 2: base de datos

**Row Level Security en todas las tablas** (`supabase/migrations/20261124150100_rls_y_permisos.sql`)
- Tablas de usuario: cuatro políticas (ver, crear, editar, borrar) con `user_id = auth.uid()`. `WITH CHECK` impide crear un registro a nombre de otro o "mudar" uno propio a otra cuenta.
- Se usa `(select auth.uid())` para que Postgres lo calcule una vez por consulta y no por fila.
- Referencias (`met_activities`, `exercises`, `foods_cache`): solo `SELECT` para usuarios con sesión. No hay políticas de escritura: solo el servidor, con la clave secreta, puede escribir.
- `food_search_cache` y `rate_limits`: RLS activo y sin políticas, así que nadie accede por la API.
- Un test verifica que **ninguna** tabla de `public` quede sin RLS.

**GRANT/REVOKE además de RLS (defensa en profundidad)**
- Supabase da por defecto todos los permisos a `anon` y `authenticated`. La migración los revoca y otorga solo lo necesario. Si algún día una política quedara mal escrita, el permiso de tabla sigue cerrando la puerta.
- `anon` (visitante sin sesión) no puede leer ninguna tabla.
- `ALTER DEFAULT PRIVILEGES` hace que las tablas que se creen en el futuro también nazcan cerradas.

**Integridad entre datos de distintos usuarios**
- Las relaciones entre tablas del mismo usuario usan FK compuestas `(id, user_id)`. Es imposible marcar el hábito de otra persona o registrar una comida con el alimento personalizado de otro, aunque se conozca su id.

**Funciones `SECURITY DEFINER`**
- Solo dos: `handle_new_user` (crea el perfil al registrarse) y `consume_rate_limit`. Ambas con `search_path = ''` para evitar que se usen objetos homónimos maliciosos, y `consume_rate_limit` solo toca el contador de `auth.uid()`, con buckets y límites acotados.
- `EXECUTE` revocado de `public` y `anon` en todas las funciones.

**Validación en la base además de Zod**
- `CHECK` con rangos razonables (peso 25–350 kg, altura 100–250 cm, porciones hasta 5 kg, nutrientes por 100 g físicamente posibles, etc.). También frenan datos corruptos de APIs externas.
- Piso calórico por sexo (1200/1500 kcal) con trigger en `daily_targets`.
- Zona horaria validada contra `pg_timezone_names`.
- `image_url` del caché solo acepta `https://images.openfoodfacts.org/…`, coincidiendo con la CSP.

**Borrado de cuenta**
- Todas las tablas de usuario tienen `ON DELETE CASCADE` hacia `auth.users`: borrar el usuario borra todo. Hay un test que lo verifica.

**Datos mínimos**
- Sin nombre, teléfono, foto, notas libres ni campos "por las dudas". El email lo guarda Supabase Auth.

## Etapa 3: autenticación

**Sesión solo en el servidor, con cookies httpOnly** (`src/server/supabase/cookie-options.ts`)
- El navegador nunca habla con Supabase: login, datos y refresco pasan por Server Actions, Route Handlers y el proxy. Eso permite marcar las cookies de sesión como `httpOnly` (JavaScript no las puede leer, así que un XSS no puede robar la sesión), `Secure` en producción y `SameSite=Lax`.
- Por lo mismo, la CSP quedó con `connect-src 'self'`: el navegador no puede mandar datos a ningún otro dominio.

**Verificación de identidad**
- Siempre `getClaims()`, que valida la firma del JWT. Nunca `getSession()` para decidir permisos: lee la cookie sin verificarla.
- `proxy.ts` refresca el token vencido y redirige, pero **no es la única barrera**: cada página privada llama a `requireUser()` y la base aplica RLS. Si el proxy se salteara (como en la vulnerabilidad CVE-2025-29927 de Next), los datos siguen protegidos.
- Las respuestas que escriben cookies de sesión llevan `Cache-Control: private, no-store` para que ningún CDN las guarde.

**Rutas privadas por defecto** (`src/lib/auth/routes.ts`)
- Hay una lista cerrada de rutas públicas (login, registro, recuperar, `/auth/*`). Cualquier ruta nueva nace privada.

**Sin "open redirect"** (`src/lib/auth/redirect.ts`)
- El parámetro `next` solo acepta rutas internas. `//malo.com`, `https://…`, `/\malo.com` y caracteres de control vuelven a `/`. Tiene tests.

**No revelar quién tiene cuenta**
- Registro y "olvidé mi contraseña" responden lo mismo exista o no el email.
- Login fallido: "el email o la contraseña no coinciden", sin decir cuál.

**Errores sin detalles internos**
- Los errores de Supabase se traducen a códigos propios y a textos fijos en español (`src/features/auth/messages.ts`). Por URL solo se aceptan códigos de una lista cerrada: nunca se muestra texto que venga en la URL.
- Los logs del servidor registran solo el código y el status del error: nunca emails, contraseñas ni tokens.
- `error.tsx` muestra un mensaje genérico, sin stack ni mensaje del error.

**Google OAuth con PKCE**
- El "code verifier" queda en una cookie httpOnly: el código que devuelve Google solo sirve en el navegador que empezó el login.
- El login con Google arranca con un link (`GET /auth/google`) y no con un formulario, para no tener que abrir `form-action` de la CSP a Google.

**Links de mail con `token_hash`** (`/auth/confirm`)
- Funcionan aunque el mail se abra en otro dispositivo. Solo se aceptan los tipos `email`, `signup`, `recovery` y `email_change`.

**Contraseñas**
- Mínimo 10 caracteres, con letras y números; máximo 72 (el límite real de bcrypt). Se valida con Zod en el cliente y en el servidor, y conviene configurar el mismo mínimo en Supabase.
- Cerrar sesión es un POST (formulario), no un link: no se puede disparar desde otro sitio con una imagen o un link.

**CSRF**
- Las Server Actions de Next comparan `Origin` con `Host` y rechazan pedidos de otros sitios. Las cookies `SameSite=Lax` suman otra capa.
