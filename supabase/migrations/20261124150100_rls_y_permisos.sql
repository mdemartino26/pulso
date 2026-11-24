-- =============================================================================
-- Pulso: Row Level Security y permisos
--
-- Reglas:
--   1. RLS activado en TODAS las tablas de `public`.
--   2. Tablas de usuario: cada uno lee, crea, edita y borra solo lo suyo
--      (user_id = auth.uid()). `WITH CHECK` impide además crear o mover un
--      registro a nombre de otro usuario.
--   3. Tablas de referencia (MET, ejercicios, caché de alimentos): solo
--      lectura para usuarios autenticados. Las escribe únicamente el servidor
--      con la clave secreta, que saltea RLS.
--   4. Tablas internas (caché de búsquedas, rate limits): sin acceso por API.
--   5. El rol `anon` (visitante sin sesión) no tiene acceso a ninguna tabla.
--
-- `(select auth.uid())` en vez de `auth.uid()`: Postgres lo evalúa una vez
-- por consulta y no una vez por fila (recomendación de Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos base (defensa en profundidad: además de RLS, los GRANT)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Que las tablas futuras tampoco queden abiertas por defecto.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Tablas de usuario: CRUD (filtrado por RLS).
grant select, insert, update, delete on
  public.daily_targets,
  public.weight_entries,
  public.custom_foods,
  public.food_entries,
  public.favorite_foods,
  public.activity_entries,
  public.strength_sets,
  public.step_entries,
  public.water_entries,
  public.wellbeing_entries,
  public.habits,
  public.habit_checks
to authenticated;

-- Perfil: se crea por trigger y se borra junto con la cuenta.
grant select, update on public.profiles to authenticated;

-- Referencias: solo lectura.
grant select on public.met_activities, public.exercises, public.foods_cache to authenticated;

-- Rate limit: solo a través de la función.
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.daily_targets     enable row level security;
alter table public.weight_entries    enable row level security;
alter table public.foods_cache       enable row level security;
alter table public.food_search_cache enable row level security;
alter table public.custom_foods      enable row level security;
alter table public.food_entries      enable row level security;
alter table public.favorite_foods    enable row level security;
alter table public.met_activities    enable row level security;
alter table public.exercises         enable row level security;
alter table public.activity_entries  enable row level security;
alter table public.strength_sets     enable row level security;
alter table public.step_entries      enable row level security;
alter table public.water_entries     enable row level security;
alter table public.wellbeing_entries enable row level security;
alter table public.habits            enable row level security;
alter table public.habit_checks      enable row level security;
alter table public.rate_limits       enable row level security;

-- -----------------------------------------------------------------------------
-- profiles (la clave es `id`, no `user_id`)
-- -----------------------------------------------------------------------------
create policy "profiles: ver el propio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- daily_targets
-- -----------------------------------------------------------------------------
create policy "daily_targets: ver propias"
  on public.daily_targets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "daily_targets: crear propias"
  on public.daily_targets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "daily_targets: editar propias"
  on public.daily_targets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "daily_targets: borrar propias"
  on public.daily_targets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- weight_entries
-- -----------------------------------------------------------------------------
create policy "weight_entries: ver propios"
  on public.weight_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "weight_entries: crear propios"
  on public.weight_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "weight_entries: editar propios"
  on public.weight_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "weight_entries: borrar propios"
  on public.weight_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- custom_foods
-- -----------------------------------------------------------------------------
create policy "custom_foods: ver propios"
  on public.custom_foods for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "custom_foods: crear propios"
  on public.custom_foods for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "custom_foods: editar propios"
  on public.custom_foods for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "custom_foods: borrar propios"
  on public.custom_foods for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- food_entries
-- -----------------------------------------------------------------------------
create policy "food_entries: ver propias"
  on public.food_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "food_entries: crear propias"
  on public.food_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "food_entries: editar propias"
  on public.food_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "food_entries: borrar propias"
  on public.food_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- favorite_foods (no se editan: se crean o se borran)
-- -----------------------------------------------------------------------------
create policy "favorite_foods: ver propios"
  on public.favorite_foods for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "favorite_foods: crear propios"
  on public.favorite_foods for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "favorite_foods: borrar propios"
  on public.favorite_foods for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- activity_entries
-- -----------------------------------------------------------------------------
create policy "activity_entries: ver propias"
  on public.activity_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "activity_entries: crear propias"
  on public.activity_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "activity_entries: editar propias"
  on public.activity_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "activity_entries: borrar propias"
  on public.activity_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- strength_sets
-- -----------------------------------------------------------------------------
create policy "strength_sets: ver propias"
  on public.strength_sets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "strength_sets: crear propias"
  on public.strength_sets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "strength_sets: editar propias"
  on public.strength_sets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "strength_sets: borrar propias"
  on public.strength_sets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- step_entries
-- -----------------------------------------------------------------------------
create policy "step_entries: ver propios"
  on public.step_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "step_entries: crear propios"
  on public.step_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "step_entries: editar propios"
  on public.step_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "step_entries: borrar propios"
  on public.step_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- water_entries
-- -----------------------------------------------------------------------------
create policy "water_entries: ver propios"
  on public.water_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "water_entries: crear propios"
  on public.water_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "water_entries: editar propios"
  on public.water_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "water_entries: borrar propios"
  on public.water_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- wellbeing_entries
-- -----------------------------------------------------------------------------
create policy "wellbeing_entries: ver propios"
  on public.wellbeing_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "wellbeing_entries: crear propios"
  on public.wellbeing_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "wellbeing_entries: editar propios"
  on public.wellbeing_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "wellbeing_entries: borrar propios"
  on public.wellbeing_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- habits
-- -----------------------------------------------------------------------------
create policy "habits: ver propios"
  on public.habits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habits: crear propios"
  on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habits: editar propios"
  on public.habits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "habits: borrar propios"
  on public.habits for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- habit_checks (no se editan: se marcan o se desmarcan)
-- -----------------------------------------------------------------------------
create policy "habit_checks: ver propios"
  on public.habit_checks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habit_checks: crear propios"
  on public.habit_checks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habit_checks: borrar propios"
  on public.habit_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Referencias: solo lectura para usuarios con sesión
-- -----------------------------------------------------------------------------
create policy "met_activities: lectura autenticados"
  on public.met_activities for select to authenticated
  using (true);

create policy "exercises: lectura autenticados"
  on public.exercises for select to authenticated
  using (true);

create policy "foods_cache: lectura autenticados"
  on public.foods_cache for select to authenticated
  using (true);

-- food_search_cache y rate_limits: RLS activado y SIN políticas = nadie
-- accede por la API. El servidor usa la clave secreta (caché) o la función
-- consume_rate_limit (rate limits).
