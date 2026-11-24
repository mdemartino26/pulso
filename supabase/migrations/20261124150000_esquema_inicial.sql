-- =============================================================================
-- Pulso: esquema inicial (Fase 1 / MVP)
--
-- Convenciones:
--   * Toda tabla de usuario tiene `user_id uuid not null default auth.uid()`
--     con FK a auth.users ON DELETE CASCADE: al borrar la cuenta se borra todo.
--   * El "día" de cada registro es una columna `date` calculada en la zona
--     horaria del perfil (lo hace el servidor), no derivada de timestamps UTC.
--   * Los rangos razonables se validan con CHECK además de Zod: si algo se
--     saltea la app (ej. una llamada directa a la API), la base igual protege.
--   * Las relaciones entre tablas del mismo usuario usan FK compuestas
--     (id, user_id): así es imposible colgar un registro propio de un
--     hábito o alimento de OTRO usuario.
--   * Datos mínimos: no hay nombre, teléfono, foto ni campos "por las dudas".
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.biological_sex as enum ('female', 'male');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'high');
create type public.goal_type as enum ('lose', 'maintain', 'gain');
create type public.meal_type as enum ('breakfast', 'lunch', 'afternoon_snack', 'dinner', 'snack');
create type public.food_source as enum ('usda', 'off', 'custom');
-- Base de los valores nutricionales: por 100 g o por 100 ml.
create type public.nutrient_basis as enum ('g', 'ml');
create type public.serving_unit as enum ('g', 'ml', 'unit', 'serving');
create type public.intensity as enum ('low', 'moderate', 'high');
create type public.activity_category as enum ('gym', 'cardio', 'sport', 'daily');
create type public.target_source as enum ('formula', 'adaptive');

-- -----------------------------------------------------------------------------
-- Funciones utilitarias
-- -----------------------------------------------------------------------------

-- Mantiene updated_at al día.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- PERFIL
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Datos para la fórmula de Mifflin-St Jeor. Nulos hasta completar el onboarding.
  sex public.biological_sex,
  birth_date date check (birth_date between date '1900-01-01' and date '2100-01-01'),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  activity_level public.activity_level,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  goal public.goal_type,
  -- Magnitud del ritmo semanal en kg (siempre positiva; el signo lo da `goal`).
  weekly_rate_kg numeric(3, 2) check (weekly_rate_kg between 0 and 1),
  -- Meta de agua elegida a mano. Null = usar la calculada.
  water_goal_ml_override integer check (water_goal_ml_override between 500 and 6000),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mantener = ritmo 0. Bajar/subir = ritmo > 0.
  constraint profiles_rate_matches_goal check (
    goal is null
    or (goal = 'maintain' and weekly_rate_kg = 0)
    or (goal <> 'maintain' and weekly_rate_kg > 0)
  ),
  -- Un onboarding completo exige todos los datos de la fórmula.
  constraint profiles_onboarding_complete check (
    onboarding_completed_at is null
    or (sex is not null and birth_date is not null and height_cm is not null
        and activity_level is not null and goal is not null and weekly_rate_kg is not null)
  )
);

comment on table public.profiles is
  'Un perfil por usuario. El peso actual NO se guarda acá: es el último registro de weight_entries.';

-- La zona horaria tiene que existir en Postgres (evita que un valor inválido
-- rompa el cálculo del "día"). Se valida con trigger porque pg_timezone_names
-- no puede usarse en un CHECK.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria inválida' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil vacío cuando alguien se registra (email o Google).
-- SECURITY DEFINER porque corre en el contexto de auth; search_path vacío
-- para que nadie pueda "secuestrar" funciones con objetos homónimos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- METAS DIARIAS
-- Foto de la meta calculada para cada día. Sin esto, cambiar el nivel de
-- actividad o el peso "reescribiría" el pasado. Fase 2: el ajuste automático
-- del gasto escribe acá con source = 'adaptive'.
-- =============================================================================
create table public.daily_targets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  bmr_kcal integer not null check (bmr_kcal between 500 and 5000),
  tdee_kcal integer not null check (tdee_kcal between 800 and 8000),
  kcal_target integer not null check (kcal_target between 1200 and 8000),
  protein_min_g integer not null check (protein_min_g between 0 and 500),
  protein_max_g integer not null check (protein_max_g between 0 and 500),
  water_ml integer not null check (water_ml between 500 and 8000),
  source public.target_source not null default 'formula',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  check (protein_max_g >= protein_min_g)
);

-- Piso de seguridad según sexo (1200 mujeres / 1500 hombres), también en la base.
create or replace function public.enforce_kcal_floor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sex public.biological_sex;
begin
  select sex into v_sex from public.profiles where id = new.user_id;
  if v_sex = 'male' and new.kcal_target < 1500 then
    raise exception 'La meta calórica no puede ser menor a 1500 kcal' using errcode = '23514';
  end if;
  if new.kcal_target < 1200 then
    raise exception 'La meta calórica no puede ser menor a 1200 kcal' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger daily_targets_kcal_floor
  before insert or update on public.daily_targets
  for each row execute function public.enforce_kcal_floor();

create trigger daily_targets_set_updated_at
  before update on public.daily_targets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- PESO (un registro por día; volver a cargar el mismo día lo reemplaza)
-- =============================================================================
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  weight_kg numeric(5, 2) not null check (weight_kg between 25 and 350),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ALIMENTOS
-- =============================================================================

-- Caché COMPARTIDO de alimentos de USDA / Open Food Facts. Sin datos de
-- usuario. Solo lo escribe el servidor (clave secreta); los usuarios lo leen.
-- Los valores son por 100 g o 100 ml (según `basis`).
create table public.foods_cache (
  id uuid primary key default gen_random_uuid(),
  source public.food_source not null check (source <> 'custom'),
  source_id text not null check (char_length(source_id) between 1 and 64),
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  basis public.nutrient_basis not null default 'g',
  kcal_100 numeric(5, 1) not null check (kcal_100 between 0 and 900),
  protein_100 numeric(5, 2) not null check (protein_100 between 0 and 100),
  carbs_100 numeric(5, 2) not null check (carbs_100 between 0 and 100),
  fat_100 numeric(5, 2) not null check (fat_100 between 0 and 100),
  fiber_100 numeric(5, 2) check (fiber_100 between 0 and 100),
  sugars_100 numeric(5, 2) check (sugars_100 between 0 and 100),
  sodium_mg_100 numeric(7, 1) check (sodium_mg_100 between 0 and 40000),
  -- Porción declarada por el producto (ej. 30 g = "1 alfajor").
  serving_size numeric(6, 1) check (serving_size > 0 and serving_size <= 5000),
  serving_label text check (char_length(serving_label) <= 60),
  -- Solo imágenes de Open Food Facts por https (coincide con la CSP).
  image_url text check (image_url ~ '^https://images\.openfoodfacts\.org/'),
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);

create index foods_cache_barcode_idx on public.foods_cache (barcode) where barcode is not null;
create index foods_cache_name_trgm_idx on public.foods_cache using gin (name extensions.gin_trgm_ops);

-- Resultados de búsquedas por proveedor (para no repetir llamadas a las APIs).
-- Solo servidor: ni siquiera los usuarios autenticados lo leen directo.
create table public.food_search_cache (
  provider public.food_source not null check (provider <> 'custom'),
  query_norm text not null check (char_length(query_norm) between 1 and 100),
  food_ids uuid[] not null default '{}' check (cardinality(food_ids) <= 50),
  fetched_at timestamptz not null default now(),
  primary key (provider, query_norm)
);

-- Alimentos cargados a mano por el usuario.
create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand text check (char_length(brand) <= 120),
  basis public.nutrient_basis not null default 'g',
  kcal_100 numeric(5, 1) not null check (kcal_100 between 0 and 900),
  protein_100 numeric(5, 2) not null check (protein_100 between 0 and 100),
  carbs_100 numeric(5, 2) not null check (carbs_100 between 0 and 100),
  fat_100 numeric(5, 2) not null check (fat_100 between 0 and 100),
  fiber_100 numeric(5, 2) check (fiber_100 between 0 and 100),
  sugars_100 numeric(5, 2) check (sugars_100 between 0 and 100),
  sodium_mg_100 numeric(7, 1) check (sodium_mg_100 between 0 and 40000),
  serving_size numeric(6, 1) check (serving_size > 0 and serving_size <= 5000),
  serving_label text check (char_length(serving_label) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id) -- destino de las FK compuestas
);

create index custom_foods_user_idx on public.custom_foods (user_id);

create trigger custom_foods_set_updated_at
  before update on public.custom_foods
  for each row execute function public.set_updated_at();

-- Registro de comidas. Guarda una COPIA de los nutrientes por 100 g/ml al
-- momento de registrar: si la fuente cambia o se borra, el historial no cambia.
-- Los totales son columnas generadas: no se pueden falsear ni desincronizar.
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  meal public.meal_type not null,
  source public.food_source not null,
  food_cache_id uuid references public.foods_cache (id) on delete set null,
  custom_food_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  basis public.nutrient_basis not null default 'g',
  quantity numeric(7, 2) not null check (quantity > 0 and quantity <= 10000),
  unit public.serving_unit not null,
  -- Cuántos g/ml equivale 1 `unit` (1 para g y ml; ej. 30 para "1 alfajor").
  base_per_unit numeric(7, 2) not null check (base_per_unit > 0 and base_per_unit <= 5000),
  kcal_100 numeric(5, 1) not null check (kcal_100 between 0 and 900),
  protein_100 numeric(5, 2) not null check (protein_100 between 0 and 100),
  carbs_100 numeric(5, 2) not null check (carbs_100 between 0 and 100),
  fat_100 numeric(5, 2) not null check (fat_100 between 0 and 100),
  fiber_100 numeric(5, 2) check (fiber_100 between 0 and 100),
  sugars_100 numeric(5, 2) check (sugars_100 between 0 and 100),
  sodium_mg_100 numeric(7, 1) check (sodium_mg_100 between 0 and 40000),
  amount numeric generated always as (quantity * base_per_unit) stored,
  kcal numeric generated always as (round(quantity * base_per_unit * kcal_100 / 100, 1)) stored,
  protein_g numeric generated always as (round(quantity * base_per_unit * protein_100 / 100, 1)) stored,
  carbs_g numeric generated always as (round(quantity * base_per_unit * carbs_100 / 100, 1)) stored,
  fat_g numeric generated always as (round(quantity * base_per_unit * fat_100 / 100, 1)) stored,
  fiber_g numeric generated always as (round(quantity * base_per_unit * fiber_100 / 100, 1)) stored,
  sugars_g numeric generated always as (round(quantity * base_per_unit * sugars_100 / 100, 1)) stored,
  sodium_mg numeric generated always as (round(quantity * base_per_unit * sodium_mg_100 / 100, 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una porción no puede superar 5 kg / 5 L.
  check (quantity * base_per_unit <= 5000),
  -- El origen tiene que ser coherente con la referencia.
  check (
    (source = 'custom' and food_cache_id is null)
    or (source <> 'custom' and custom_food_id is null)
  ),
  -- El alimento personalizado tiene que ser del mismo usuario.
  foreign key (custom_food_id, user_id)
    references public.custom_foods (id, user_id) on delete set null (custom_food_id)
);

create index food_entries_user_date_idx on public.food_entries (user_id, date, meal);
create index food_entries_user_recent_idx on public.food_entries (user_id, created_at desc);
create index food_entries_food_cache_idx on public.food_entries (food_cache_id) where food_cache_id is not null;
create index food_entries_custom_food_idx on public.food_entries (custom_food_id) where custom_food_id is not null;

create trigger food_entries_set_updated_at
  before update on public.food_entries
  for each row execute function public.set_updated_at();

-- Favoritos: apuntan a un alimento del caché o a uno personalizado propio.
create table public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_cache_id uuid references public.foods_cache (id) on delete cascade,
  custom_food_id uuid,
  created_at timestamptz not null default now(),
  check (num_nonnulls(food_cache_id, custom_food_id) = 1),
  foreign key (custom_food_id, user_id)
    references public.custom_foods (id, user_id) on delete cascade,
  unique (user_id, food_cache_id),
  unique (user_id, custom_food_id)
);

create index favorite_foods_food_cache_idx on public.favorite_foods (food_cache_id) where food_cache_id is not null;
create index favorite_foods_custom_food_idx on public.favorite_foods (custom_food_id, user_id) where custom_food_id is not null;

-- =============================================================================
-- ACTIVIDAD
-- =============================================================================

-- Tabla de referencia de valores MET (seed en la migración de referencias).
create table public.met_activities (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_es text not null,
  category public.activity_category not null,
  met_low numeric(4, 1) not null check (met_low between 1 and 25),
  met_moderate numeric(4, 1) not null check (met_moderate between 1 and 25),
  met_high numeric(4, 1) not null check (met_high between 1 and 25),
  -- Caminar/correr: generan pasos que ya cuentan como ejercicio.
  is_ambulatory boolean not null default false,
  check (met_low <= met_moderate and met_moderate <= met_high)
);

-- Ejercicios de gimnasio para series/repeticiones e historial de fuerza.
create table public.exercises (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_es text not null,
  muscle_group text not null
);

-- Una sesión de actividad (gimnasio, cardio, deporte...).
-- `met_value` y `kcal` son la foto del cálculo al momento de registrar.
create table public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  met_activity_id smallint not null references public.met_activities (id),
  intensity public.intensity not null default 'moderate',
  duration_min smallint not null check (duration_min between 1 and 600),
  met_value numeric(4, 1) not null check (met_value between 1 and 25),
  -- Calorías por ENCIMA del basal: (MET − 1) × kg × horas.
  kcal integer not null check (kcal between 0 and 5000),
  -- Pasos que esta actividad ya incluye (caminata/carrera). Se descuentan de
  -- los pasos del día para no contarlos dos veces.
  steps_included integer not null default 0 check (steps_included between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index activity_entries_user_date_idx on public.activity_entries (user_id, date);
create index activity_entries_met_idx on public.activity_entries (met_activity_id);

create trigger activity_entries_set_updated_at
  before update on public.activity_entries
  for each row execute function public.set_updated_at();

-- Series de fuerza dentro de una sesión.
create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_entry_id uuid not null,
  exercise_id smallint not null references public.exercises (id),
  set_number smallint not null check (set_number between 1 and 50),
  reps smallint not null check (reps between 1 and 200),
  -- 0 = peso corporal.
  weight_kg numeric(5, 2) not null default 0 check (weight_kg between 0 and 500),
  created_at timestamptz not null default now(),
  foreign key (activity_entry_id, user_id)
    references public.activity_entries (id, user_id) on delete cascade
);

create index strength_sets_entry_idx on public.strength_sets (activity_entry_id, user_id);
create index strength_sets_history_idx on public.strength_sets (user_id, exercise_id, created_at desc);
create index strength_sets_exercise_idx on public.strength_sets (exercise_id);

-- Pasos del día (carga manual).
create table public.step_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  steps integer not null check (steps between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create trigger step_entries_set_updated_at
  before update on public.step_entries
  for each row execute function public.set_updated_at();

-- =============================================================================
-- AGUA, BIENESTAR Y HÁBITOS
-- =============================================================================

-- Cada toque de "+250 ml" es una fila: deshacer = borrar la última.
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  amount_ml smallint not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create index water_entries_user_date_idx on public.water_entries (user_id, date);

-- Sueño y ánimo: opcionales, uno por día.
create table public.wellbeing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  mood smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date),
  check (num_nonnulls(sleep_hours, mood) >= 1)
);

create trigger wellbeing_entries_set_updated_at
  before update on public.wellbeing_entries
  for each row execute function public.set_updated_at();

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order smallint not null default 0,
  -- Archivar en vez de borrar conserva el historial de rachas.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index habits_user_idx on public.habits (user_id) where archived_at is null;

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- Un check por hábito y día. Desmarcar = borrar la fila.
create table public.habit_checks (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null check (date >= date '2000-01-01'),
  created_at timestamptz not null default now(),
  primary key (habit_id, date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create index habit_checks_user_date_idx on public.habit_checks (user_id, date);

-- =============================================================================
-- RATE LIMITING (para los Route Handlers de búsqueda de alimentos)
-- En Vercel cada instancia tiene su propia memoria, así que el contador
-- vive en Postgres. Solo se accede mediante la función de abajo.
-- =============================================================================
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('food_search', 'food_barcode')),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Suma 1 al contador del usuario actual y devuelve true si sigue dentro del
-- límite. SECURITY DEFINER porque los usuarios no tienen permisos sobre la
-- tabla; solo pueden tocar SU contador (auth.uid()), con límites acotados.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_max not between 1 and 1000 or p_window_seconds not between 1 and 86400 then
    raise exception 'Parámetros inválidos' using errcode = '22023';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  -- Limpieza oportunista de ventanas viejas del mismo usuario.
  delete from public.rate_limits
  where user_id = v_uid and window_start < now() - interval '1 day';

  return v_count <= p_max;
end;
$$;
