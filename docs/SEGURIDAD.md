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

## Etapa 4: perfil y cálculos

**Límites de salud validados en el servidor**
- El esquema Zod del perfil (`src/lib/validation/profile.ts`) es el mismo en el formulario y en la Server Action. El formulario avisa antes de enviar, pero el servidor vuelve a calcular y rechaza un ritmo de más del 1 % del peso por semana o una meta por debajo del piso (1200 kcal mujeres, 1500 kcal varones). Además, el trigger `enforce_kcal_floor` de la base lo impide aunque alguien saltee la app.
- Edad mínima 18 años y aviso de salud obligatorio en el onboarding (embarazo, lactancia, trastornos de la conducta alimentaria, condiciones médicas).
- Rangos razonables en todos los números (altura 100–250 cm, peso 30–300 kg, agua 500–6000 ml).

**Errores sin detalles internos**
- Si falla la base, la persona ve "No pudimos guardar tus datos" y el log del servidor guarda solo el código del error (`RepositoryError`), nunca los datos de salud.

**Datos mínimos**
- El perfil guarda solo lo que usa la fórmula: sexo biológico, fecha de nacimiento, altura, nivel de actividad, zona horaria, objetivo y ritmo. El peso va en `weight_entries` (con fecha) para poder ver la tendencia.

**La UI no depende de Supabase**
- Las páginas llaman a servicios (`profile-service.ts`) que reciben repositorios por parámetro. Los tests usan repositorios en memoria.

## Etapa 5: registro de comidas

**La API key de USDA nunca llega al navegador**
- El navegador solo habla con nuestras rutas `/api/foods/search` y `/api/foods/barcode/[código]`. El servidor consulta USDA y Open Food Facts. La key viaja en el header `X-Api-Key` (no en la URL, así no queda en logs de proxies) y vive solo en `USDA_API_KEY`.
- La CSP sigue con `connect-src 'self'`: aunque hubiera un script malicioso, no podría llamar a otros dominios.

**Límite por usuario**
- 30 búsquedas y 20 códigos por minuto por persona (`consume_rate_limit`, en la base, por usuario autenticado). Al pasarse, la API responde 429 con un mensaje amable.

**Los datos externos no son confiables**
- Todo lo que devuelven USDA y Open Food Facts pasa por Zod y por `src/server/food/providers/sanitize.ts`: se descartan productos sin calorías o con valores imposibles (por ejemplo, más de 900 kcal o más de 105 g de macros cada 100 g), se limpian caracteres de control, se recortan los textos y solo se aceptan imágenes `https://images.openfoodfacts.org`.
- Las llamadas tienen timeout de 6 s, no siguen redirecciones, no mandan cookies y tienen tope de tamaño. Si un proveedor falla, se responde con la caché y se avisa.
- Los textos externos se muestran como texto (React los escapa): un nombre como `<script>` se ve tal cual y no se ejecuta.

**Caché compartida escrita solo por el servidor**
- `foods_cache` y `food_search_cache` son compartidas entre usuarios. Si cualquiera pudiera escribirlas, podría "envenenarlas" con datos falsos. Por eso los usuarios solo pueden leer `foods_cache` y no tienen ningún acceso a `food_search_cache`.
- Las escribe `src/server/repositories/food-cache-writer.ts` con la clave secreta (`src/server/supabase/admin.ts`). Una regla de ESLint impide importar el cliente con clave secreta desde cualquier otro archivo.

**El cliente nunca manda calorías**
- Para registrar una comida, el formulario manda solo la referencia del alimento, la cantidad y la unidad. El servidor busca los nutrientes en la base y guarda una copia ("snapshot") en `food_entries`. Así nadie puede inventar valores y las comidas viejas no cambian si después se actualiza el alimento.
- Las calorías de cada entrada las calcula la base (columnas generadas).

**Validación en el servidor**
- Cantidades de 0,1 a 10.000 y porción total de hasta 5 kg / 5 L; fechas de hoy hasta un año atrás (nada en el futuro); ids con formato UUID; códigos de barras de 8, 12, 13 o 14 dígitos (así no pueden alterar la URL del proveedor).
- Los alimentos propios usan los mismos límites que la base. Un campo vacío es un error, no un 0.
- La búsqueda en la base escapa los comodines de `LIKE` y todo pasa por el query builder (nada de SQL armado con texto).

**Cámara**
- `Permissions-Policy: camera=(self)`. La cámara se enciende solo con el escáner abierto y se apaga al cerrarlo. El video se lee en el navegador y no se sube a ningún lado. Si no hay cámara o no hay permiso, se puede escribir el código.

## Etapa 6: actividad

**El cliente nunca manda calorías ni MET**
- El formulario manda qué actividad (id de la tabla `met_activities`), la intensidad, los minutos y, en pesas, las series. El servidor busca el MET en la base, usa el último peso registrado y calcula las calorías y los pasos incluidos. Si alguien agrega `kcal=9999` al envío, se ignora.
- La vista previa de calorías del formulario es solo orientativa: el número que se guarda es el del servidor.

**Validación en el servidor**
- Duración de 1 a 600 minutos, intensidad de una lista cerrada, pasos de 0 a 100.000, series de 1 a 200 repeticiones y de 0 a 500 kg, máximo 50 series por actividad. Las fechas van de hoy hasta un año atrás.
- Las series llegan como JSON en un campo oculto: se limita su tamaño (20.000 caracteres) antes de parsearlo y después pasa por Zod. Solo se aceptan ejercicios que existen y solo en actividades de fuerza.
- La base repite los mismos límites con `check` y no hace falta ninguna migración nueva: RLS y permisos de `activity_entries`, `strength_sets` y `step_entries` ya estaban desde la Etapa 2.

**Series siempre de la misma persona**
- `strength_sets` referencia a `(activity_entries.id, user_id)`: aunque alguien adivine el id de una actividad ajena, la base no le deja colgarle series. Además RLS filtra por `user_id = auth.uid()`.
- Si una actividad ajena se pide por URL, la respuesta es 404 (no se distingue de "no existe").

## Etapa 7: panel del día, agua, peso, sueño, ánimo y hábitos

**Validación en el servidor**
- Agua de 50 a 3000 ml por toque; peso de 30 a 300 kg; sueño de 0 a 24 h (se redondea a media hora); ánimo de 1 a 5; nombres de hábitos de 1 a 60 caracteres, sin caracteres de control. Fechas de hoy hasta un año atrás. Máximo 20 hábitos activos.
- Marcar un hábito verifica que sea un hábito activo de la persona. Además `habit_checks` referencia a `(habits.id, user_id)`, así que la base impide marcar hábitos ajenos aunque alguien adivine el id.

**Sin migraciones nuevas**
- `water_entries`, `wellbeing_entries`, `habits` y `habit_checks` ya tenían RLS (`user_id = auth.uid()`) y permisos desde la Etapa 2.

**Datos mínimos**
- Sueño y ánimo son opcionales y se guardan como número; no hay notas de texto libre (menos datos sensibles para proteger).
- Archivar un hábito no lo borra: conserva el historial. Los datos se borran todos al eliminar la cuenta (Etapa 9).

**Sin estilos ni scripts externos**
- El nuevo diseño usa solo Tailwind y variables CSS propias: no se sumó ningún dominio a la CSP.
