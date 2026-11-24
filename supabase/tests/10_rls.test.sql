-- =============================================================================
-- Tests de RLS, permisos y restricciones.
-- Corre con: scripts/test-db.sh (Postgres común + stub de Supabase).
-- Cada bloque usa ASSERT: si algo falla, psql corta con error.
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\o /dev/null

-- Ayudante: ejecuta SQL y verifica que FALLE con el código esperado.
--   42501 = sin permiso (RLS o GRANT) · 23503 = FK · 23514 = CHECK · 22023 = valor inválido
create or replace function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $$
declare
  v_state text;
begin
  begin
    execute p_sql;
  exception
    when others then
      v_state := sqlstate;
  end;
  if v_state is null then
    raise exception '[%] se esperaba el error % y no hubo ninguno', p_label, p_state;
  elsif v_state <> p_state then
    raise exception '[%] se esperaba el error % y hubo %', p_label, p_state, v_state;
  end if;
end;
$$;
grant execute on function pg_temp.expect_error(text, text, text) to anon, authenticated;

-- Ayudante: actuar como un usuario (como hace PostgREST con el JWT).
create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  set role authenticated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos: dos usuarios, A y B (el trigger crea sus perfiles).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local');

do $$
begin
  assert (select count(*) from public.profiles) = 2, 'el trigger debe crear los perfiles';
end $$;

-- Un alimento en el caché (lo escribe el servidor).
insert into public.foods_cache (id, source, source_id, name, kcal_100, protein_100, carbs_100, fat_100, image_url)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'off', '7790040000000', 'Yogur natural', 60, 3.5, 4.7, 3, 'https://images.openfoodfacts.org/x.jpg');

-- ---------------------------------------------------------------------------
-- Usuario B carga datos propios.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

update public.profiles set sex = 'female', birth_date = '1990-05-01', height_cm = 165,
  activity_level = 'light', goal = 'lose', weekly_rate_kg = 0.5,
  onboarding_completed_at = now()
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

insert into public.weight_entries (date, weight_kg) values ('2026-11-20', 70);
insert into public.custom_foods (id, name, kcal_100, protein_100, carbs_100, fat_100)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Tarta de la abuela', 250, 8, 25, 12);
insert into public.habits (id, name) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Caminar después de cenar');
insert into public.habit_checks (habit_id, date) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2026-11-20');
insert into public.water_entries (date, amount_ml) values ('2026-11-20', 250);
insert into public.food_entries (date, meal, source, food_cache_id, name, quantity, unit, base_per_unit,
  kcal_100, protein_100, carbs_100, fat_100)
values ('2026-11-20', 'breakfast', 'off', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Yogur natural',
  1, 'unit', 190, 60, 3.5, 4.7, 3);

do $$
begin
  -- user_id se completa solo con auth.uid().
  assert (select user_id from public.weight_entries limit 1) = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  -- Totales generados: 190 g × 60 kcal / 100 = 114 kcal.
  assert (select kcal from public.food_entries limit 1) = 114.0, 'kcal generadas';
  assert (select protein_g from public.food_entries limit 1) = 6.7, 'proteína generada';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Usuario A: no ve ni toca nada de B.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

do $$
declare
  n integer;
begin
  -- Lectura
  assert (select count(*) from public.profiles) = 1, 'A solo ve su perfil';
  assert (select count(*) from public.weight_entries) = 0, 'A no ve pesos de B';
  assert (select count(*) from public.custom_foods) = 0, 'A no ve alimentos de B';
  assert (select count(*) from public.food_entries) = 0, 'A no ve comidas de B';
  assert (select count(*) from public.habits) = 0, 'A no ve hábitos de B';
  assert (select count(*) from public.habit_checks) = 0, 'A no ve checks de B';
  assert (select count(*) from public.water_entries) = 0, 'A no ve agua de B';

  -- Edición y borrado de filas ajenas: afectan 0 filas.
  update public.weight_entries set weight_kg = 50;
  get diagnostics n = row_count;
  assert n = 0, 'A no puede editar pesos de B';

  update public.profiles set height_cm = 200 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics n = row_count;
  assert n = 0, 'A no puede editar el perfil de B';

  delete from public.food_entries;
  get diagnostics n = row_count;
  assert n = 0, 'A no puede borrar comidas de B';

  -- Lectura de referencias: sí.
  assert (select count(*) from public.met_activities) > 30, 'A lee la tabla MET';
  assert (select count(*) from public.exercises) > 25, 'A lee ejercicios';
  assert (select count(*) from public.foods_cache) = 1, 'A lee el caché de alimentos';
end $$;

-- Crear filas a nombre de B: RLS lo rechaza (42501).
select pg_temp.expect_error($$insert into public.weight_entries (user_id, date, weight_kg)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-11-21', 60)$$, '42501', 'insertar a nombre de otro');

-- Mover una fila propia a otro usuario: rechazado.
insert into public.water_entries (date, amount_ml) values ('2026-11-21', 500);
select pg_temp.expect_error($$update public.water_entries
  set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, '42501', 'mover fila a otro usuario');

-- Colgarse del hábito o del alimento personalizado de B: la FK compuesta lo impide.
select pg_temp.expect_error($$insert into public.habit_checks (habit_id, date)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2026-11-21')$$, '23503', 'check en hábito ajeno');
select pg_temp.expect_error($$insert into public.food_entries (date, meal, source, custom_food_id, name,
  quantity, unit, base_per_unit, kcal_100, protein_100, carbs_100, fat_100)
  values ('2026-11-21', 'lunch', 'custom', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'x', 100, 'g', 1, 100, 1, 1, 1)$$, '23503', 'comida con alimento ajeno');
select pg_temp.expect_error($$insert into public.favorite_foods (custom_food_id)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd')$$, '23503', 'favorito ajeno');

-- Referencias y caché: solo lectura.
select pg_temp.expect_error($$insert into public.foods_cache (source, source_id, name, kcal_100, protein_100, carbs_100, fat_100)
  values ('usda', '1', 'falso', 1, 1, 1, 1)$$, '42501', 'escribir caché');
select pg_temp.expect_error($$update public.met_activities set met_moderate = 20$$, '42501', 'editar MET');
select pg_temp.expect_error($$delete from public.exercises$$, '42501', 'borrar ejercicios');

-- Tablas internas: sin acceso.
select pg_temp.expect_error($$select * from public.food_search_cache$$, '42501', 'leer caché de búsquedas');
select pg_temp.expect_error($$select * from public.rate_limits$$, '42501', 'leer rate limits');
select pg_temp.expect_error($$insert into public.profiles (id) values (gen_random_uuid())$$, '42501', 'crear perfil');
select pg_temp.expect_error($$delete from public.profiles$$, '42501', 'borrar perfil');

-- Restricciones de datos.
select pg_temp.expect_error($$insert into public.weight_entries (date, weight_kg) values ('2026-11-22', 900)$$, '23514', 'peso absurdo');
select pg_temp.expect_error($$update public.profiles set timezone = 'Marte/Olympus'$$, '22023', 'zona horaria inválida');
select pg_temp.expect_error($$update public.profiles set goal = 'maintain', weekly_rate_kg = 0.5$$, '23514', 'mantener con ritmo');
select pg_temp.expect_error($$update public.profiles set onboarding_completed_at = now()$$, '23514', 'onboarding incompleto');
select pg_temp.expect_error($$insert into public.food_entries (date, meal, source, name, quantity, unit, base_per_unit,
  kcal_100, protein_100, carbs_100, fat_100) values ('2026-11-22', 'lunch', 'usda', 'x', 100, 'unit', 100, 100, 1, 1, 1)$$, '23514', 'porción de 10 kg');

-- Piso calórico por sexo (A es hombre).
update public.profiles set sex = 'male';
select pg_temp.expect_error($$insert into public.daily_targets (date, bmr_kcal, tdee_kcal, kcal_target,
  protein_min_g, protein_max_g, water_ml) values ('2026-11-22', 1700, 2100, 1400, 120, 160, 2500)$$, '23514', 'meta < 1500 en hombre');
insert into public.daily_targets (date, bmr_kcal, tdee_kcal, kcal_target, protein_min_g, protein_max_g, water_ml)
  values ('2026-11-22', 1700, 2100, 1600, 120, 160, 2500);

-- Rate limit: 3 permitidos, el 4.º no.
do $$
begin
  assert public.consume_rate_limit('food_search', 3, 60);
  assert public.consume_rate_limit('food_search', 3, 60);
  assert public.consume_rate_limit('food_search', 3, 60);
  assert not public.consume_rate_limit('food_search', 3, 60), 'el 4.º pedido debe rechazarse';
end $$;
select pg_temp.expect_error($$select public.consume_rate_limit('otro_bucket', 3, 60)$$, '23514', 'bucket inventado');

reset role;

-- ---------------------------------------------------------------------------
-- Visitante sin sesión (anon): nada.
-- ---------------------------------------------------------------------------
set role anon;
select pg_temp.expect_error($$select * from public.profiles$$, '42501', 'anon perfiles');
select pg_temp.expect_error($$select * from public.met_activities$$, '42501', 'anon MET');
select pg_temp.expect_error($$select * from public.foods_cache$$, '42501', 'anon caché');
select pg_temp.expect_error($$select public.consume_rate_limit('food_search', 3, 60)$$, '42501', 'anon rate limit');
reset role;

-- ---------------------------------------------------------------------------
-- Toda tabla de public tiene RLS activado.
-- ---------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert missing is null, 'Tablas sin RLS: ' || coalesce(missing, '');
end $$;

-- ---------------------------------------------------------------------------
-- Borrar la cuenta de B borra TODOS sus datos (cascada).
-- ---------------------------------------------------------------------------
delete from auth.users where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$
declare
  leftovers integer;
begin
  select
    (select count(*) from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.weight_entries where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.custom_foods where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.food_entries where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.habits where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.habit_checks where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  + (select count(*) from public.water_entries where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  into leftovers;
  assert leftovers = 0, 'quedaron datos después de borrar la cuenta';
  -- El caché compartido no se toca.
  assert (select count(*) from public.foods_cache) = 1;
end $$;

\o
\echo 'OK: todos los tests de base de datos pasaron'
