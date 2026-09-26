BEGIN;

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS nom_bot text;

ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE public.clientes
  ALTER COLUMN numero DROP NOT NULL;

ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS cliente_id text,
  ADD COLUMN IF NOT EXISTS hora_fin time without time zone,
  ADD COLUMN IF NOT EXISTS duracion_servicio integer,
  ALTER COLUMN estado SET DEFAULT 'AGENDADO';

ALTER TABLE public.horario_atencion
  ADD COLUMN IF NOT EXISTS fecha date;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.horario_atencion
    WHERE fecha IS NOT NULL
    GROUP BY user_id, fecha
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'horario_atencion contiene fechas duplicadas por usuario; resuélvelas antes de migrar';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversacion_estado
    WHERE cliente_id IS NOT NULL
    GROUP BY cliente_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'conversacion_estado contiene cliente_id duplicados; resuélvelos antes de migrar';
  END IF;
END $$;

ALTER TABLE public.horario_atencion
  DROP CONSTRAINT IF EXISTS horario_atencion_user_id_dia_semana_key;

CREATE UNIQUE INDEX IF NOT EXISTS horario_atencion_user_id_fecha_key
  ON public.horario_atencion (user_id, fecha);

ALTER TABLE public.conversacion_estado
  ALTER COLUMN telefono DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversacion_estado_cliente_id_key
  ON public.conversacion_estado (cliente_id);

COMMIT;
