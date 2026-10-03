BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.empresa FROM anon, PUBLIC;
GRANT SELECT (
  id,
  user_id,
  nombre,
  direccion,
  horario,
  politicas,
  nom_bot,
  color_primario,
  color_secundario,
  logo_url
) ON TABLE public.empresa TO anon;

COMMIT;
