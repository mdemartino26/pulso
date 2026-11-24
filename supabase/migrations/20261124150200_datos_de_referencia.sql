-- =============================================================================
-- Pulso: datos de referencia (tabla MET y ejercicios de gimnasio)
--
-- Va como migración (y no en seed.sql) porque producción también lo necesita:
-- supabase/seed.sql solo corre en la base local.
--
-- Valores MET aproximados, redondeados del Compendium of Physical Activities
-- (Ainsworth et al., 2011; actualización 2024). Son estimaciones poblacionales:
-- el gasto real de cada persona puede variar ±20 % o más.
-- low / moderate / high = intensidad que elige el usuario al registrar.
-- =============================================================================

insert into public.met_activities (slug, name_es, category, met_low, met_moderate, met_high, is_ambulatory) values
  -- Gimnasio
  ('pesas',               'Pesas / musculación',          'gym',    3.5, 5.0, 6.0, false),
  ('calistenia',          'Calistenia / peso corporal',   'gym',    2.8, 3.8, 8.0, false),
  ('circuito_hiit',       'Circuito / HIIT / funcional',  'gym',    4.3, 6.0, 8.0, false),
  ('clase_aerobica',      'Clase aeróbica / step',        'gym',    5.0, 7.3, 8.5, false),
  ('cinta_caminar',       'Cinta (caminando)',            'gym',    2.8, 3.5, 5.0, true),
  ('cinta_correr',        'Cinta (corriendo)',            'gym',    8.3, 9.8, 11.8, true),
  ('bici_fija',           'Bicicleta fija',               'gym',    3.5, 6.8, 8.8, false),
  ('eliptico',            'Elíptico',                     'gym',    4.0, 5.0, 6.5, false),
  ('remo_maquina',        'Remo (máquina)',               'gym',    4.8, 7.0, 8.5, false),
  ('escaladora',          'Escaladora / stepper',         'gym',    7.0, 9.0, 10.0, false),
  ('yoga',                'Yoga',                         'gym',    2.5, 3.0, 4.0, false),
  ('pilates',             'Pilates',                      'gym',    2.8, 3.0, 3.8, false),
  ('estiramiento',        'Estiramiento / movilidad',     'gym',    2.3, 2.3, 2.8, false),
  -- Cardio al aire libre
  ('caminar',             'Caminar',                      'cardio', 2.8, 3.5, 5.0, true),
  ('correr',              'Correr',                       'cardio', 8.3, 9.8, 11.8, true),
  ('trekking',            'Trekking / senderismo',        'cardio', 5.3, 6.0, 7.8, true),
  ('bicicleta',           'Bicicleta',                    'cardio', 4.0, 8.0, 10.0, false),
  ('natacion',            'Natación',                     'cardio', 5.8, 8.3, 9.8, false),
  ('saltar_soga',         'Saltar la soga',               'cardio', 8.8, 11.8, 12.3, false),
  ('baile',               'Baile',                        'cardio', 4.5, 5.5, 7.3, false),
  ('patinaje',            'Patinaje',                     'cardio', 5.0, 7.0, 9.8, false),
  -- Deportes
  ('futbol',              'Fútbol',                       'sport',  7.0, 8.0, 10.0, false),
  ('basquet',             'Básquet',                      'sport',  4.5, 6.5, 8.0, false),
  ('tenis',               'Tenis',                        'sport',  6.0, 7.3, 8.0, false),
  ('padel',               'Pádel',                        'sport',  5.0, 6.0, 7.3, false),
  ('voley',               'Vóley',                        'sport',  3.0, 4.0, 6.0, false),
  ('hockey',              'Hockey sobre césped',          'sport',  6.0, 7.8, 9.0, false),
  ('rugby',               'Rugby',                        'sport',  6.3, 7.3, 8.3, false),
  ('boxeo',               'Boxeo',                        'sport',  5.5, 7.8, 12.8, false),
  ('artes_marciales',     'Artes marciales',              'sport',  5.3, 7.0, 10.3, false),
  ('escalada',            'Escalada',                     'sport',  5.8, 7.5, 8.0, false),
  -- Vida diaria
  ('tareas_hogar',        'Tareas del hogar',             'daily',  2.5, 3.3, 4.0, false),
  ('jardineria',          'Jardinería',                   'daily',  3.0, 3.8, 4.5, false),
  ('subir_escaleras',     'Subir escaleras',              'daily',  4.0, 6.0, 8.8, false),
  ('pasear_perro',        'Pasear al perro',              'daily',  2.8, 3.0, 3.5, true);

insert into public.exercises (slug, name_es, muscle_group) values
  -- Piernas y glúteos
  ('sentadilla',            'Sentadilla',                       'piernas'),
  ('sentadilla_bulgara',    'Sentadilla búlgara',               'piernas'),
  ('prensa',                'Prensa de piernas',                'piernas'),
  ('peso_muerto',           'Peso muerto',                      'piernas'),
  ('peso_muerto_rumano',    'Peso muerto rumano',               'piernas'),
  ('estocadas',             'Estocadas',                        'piernas'),
  ('extension_cuadriceps',  'Extensión de cuádriceps',          'piernas'),
  ('curl_femoral',          'Curl femoral',                     'piernas'),
  ('hip_thrust',            'Hip thrust',                       'glúteos'),
  ('abduccion_cadera',      'Abducción de cadera',              'glúteos'),
  ('gemelos',               'Gemelos (pantorrillas)',           'piernas'),
  -- Pecho
  ('press_banca',           'Press de banca',                   'pecho'),
  ('press_inclinado',       'Press inclinado',                  'pecho'),
  ('aperturas',             'Aperturas con mancuernas',         'pecho'),
  ('flexiones',             'Flexiones de brazos',              'pecho'),
  ('fondos',                'Fondos en paralelas',              'pecho'),
  -- Espalda
  ('dominadas',             'Dominadas',                        'espalda'),
  ('jalon_pecho',           'Jalón al pecho',                   'espalda'),
  ('remo_barra',            'Remo con barra',                   'espalda'),
  ('remo_mancuerna',        'Remo con mancuerna',               'espalda'),
  ('remo_polea',            'Remo en polea baja',               'espalda'),
  -- Hombros
  ('press_militar',         'Press militar',                    'hombros'),
  ('elevaciones_laterales', 'Elevaciones laterales',            'hombros'),
  ('face_pull',             'Face pull',                        'hombros'),
  -- Brazos
  ('curl_biceps',           'Curl de bíceps',                   'brazos'),
  ('curl_martillo',         'Curl martillo',                    'brazos'),
  ('extension_triceps',     'Extensión de tríceps en polea',    'brazos'),
  ('press_frances',         'Press francés',                    'brazos'),
  -- Core
  ('plancha',               'Plancha',                          'core'),
  ('crunch',                'Abdominales (crunch)',             'core'),
  ('elevacion_piernas',     'Elevación de piernas',             'core');
