-- Etapa 9: límite de exportaciones por usuario.
-- Exportar lee todas las tablas de la persona: se limita a 10 descargas por
-- minuto para que nadie (ni un script con una sesión robada) sature la base.
alter table public.rate_limits drop constraint rate_limits_bucket_check;
alter table public.rate_limits
  add constraint rate_limits_bucket_check check (bucket in ('food_search', 'food_barcode', 'data_export'));
