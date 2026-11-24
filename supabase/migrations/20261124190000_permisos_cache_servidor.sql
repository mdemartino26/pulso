-- =============================================================================
-- Pulso: permisos del servidor sobre la caché de alimentos (Etapa 5)
--
-- Los proyectos nuevos de Supabase pueden no dar permisos automáticos a los
-- roles de la API sobre las tablas que se crean por SQL. La clave secreta
-- usa el rol `service_role`, que saltea RLS pero igual necesita GRANT.
--
-- Damos SOLO lo que usa src/server/repositories/food-cache-writer.ts:
-- leer y escribir la caché compartida. Nada de borrar, y nada sobre las
-- tablas de los usuarios.
-- =============================================================================

grant usage on schema public to service_role;
grant select, insert, update on public.foods_cache, public.food_search_cache to service_role;
