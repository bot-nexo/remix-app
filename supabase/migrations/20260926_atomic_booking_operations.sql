BEGIN;

CREATE OR REPLACE FUNCTION public.validar_disponibilidad_cita(
  p_user_id uuid,
  p_fecha date,
  p_hora_inicio time without time zone,
  p_duracion_minutos integer,
  p_cita_excluir uuid DEFAULT NULL
)
RETURNS time without time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hora_fin time without time zone;
  v_hora_apertura time without time zone;
  v_hora_cierre time without time zone;
BEGIN
  IF p_user_id IS NULL OR p_fecha IS NULL OR p_hora_inicio IS NULL OR p_duracion_minutos IS NULL OR p_duracion_minutos <= 0 THEN
    RAISE EXCEPTION 'Los datos de horario no son válidos';
  END IF;

  IF p_fecha < CURRENT_DATE OR (p_fecha = CURRENT_DATE AND p_hora_inicio <= (CURRENT_TIME - INTERVAL '5 minutes')) THEN
    RAISE EXCEPTION 'No puedes agendar en una fecha u hora que ya pasó';
  END IF;

  SELECT hora_inicio, hora_fin
    INTO v_hora_apertura, v_hora_cierre
    FROM public.horario_atencion
   WHERE user_id = p_user_id AND fecha = p_fecha AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La fecha no está habilitada para reservas';
  END IF;

  v_hora_fin := p_hora_inicio + (p_duracion_minutos * INTERVAL '1 minute');
  IF v_hora_fin <= p_hora_inicio OR p_hora_inicio < v_hora_apertura OR v_hora_fin > v_hora_cierre THEN
    RAISE EXCEPTION 'El horario está fuera del horario de atención';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.bloqueos_agenda b
     WHERE b.user_id = p_user_id
       AND b.fecha = p_fecha
       AND (b.bloqueo_completo = true OR (p_hora_inicio < b.hora_fin AND v_hora_fin > b.hora_inicio))
  ) THEN
    RAISE EXCEPTION 'El horario está bloqueado';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.citas c
     WHERE c.user_id = p_user_id
       AND c.fecha_inicio = p_fecha
       AND c.id IS DISTINCT FROM p_cita_excluir
       AND UPPER(BTRIM(COALESCE(c.estado, ''))) NOT IN (
         'CANCELADO', 'CANCELADA', 'CANCELADO_CLIENTE', 'CANCELADO_INASISTENCIA',
         'COMPLETADA', 'COMPLETADO', 'REALIZADA', 'INASISTENCIA'
       )
       AND c.hora_inicio < v_hora_fin
       AND COALESCE(
         c.hora_fin,
         c.hora_inicio + (COALESCE(c.duracion_servicio, 30) * INTERVAL '1 minute')
       ) > p_hora_inicio
  ) THEN
    RAISE EXCEPTION 'Ese horario acaba de ser ocupado';
  END IF;

  RETURN v_hora_fin;
END;
$$;

CREATE OR REPLACE FUNCTION public.reservar_cita_segura(
  p_user_id uuid,
  p_servicio_id uuid,
  p_cliente_id text,
  p_cliente_nombre text,
  p_cliente_numero text,
  p_fecha date,
  p_hora_inicio time without time zone
)
RETURNS public.citas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duracion integer;
  v_hora_fin time without time zone;
  v_cita public.citas%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_cliente_id IS NULL OR BTRIM(COALESCE(p_cliente_nombre, '')) = '' OR BTRIM(COALESCE(p_cliente_numero, '')) = '' THEN
    RAISE EXCEPTION 'Faltan datos del cliente o del negocio';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT duracion_minutos
    INTO v_duracion
    FROM public.servicios
   WHERE id = p_servicio_id AND user_id = p_user_id AND activo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El servicio no está disponible';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id::text = p_cliente_id) THEN
    RAISE EXCEPTION 'El enlace de cliente no es válido';
  END IF;

  v_hora_fin := public.validar_disponibilidad_cita(p_user_id, p_fecha, p_hora_inicio, v_duracion);

  INSERT INTO public.citas (
    user_id, cliente_id, cliente_nombre, cliente_numero, servicio_id,
    fecha_inicio, hora_inicio, hora_fin, duracion_servicio, estado
  ) VALUES (
    p_user_id, p_cliente_id::uuid, BTRIM(p_cliente_nombre), BTRIM(p_cliente_numero), p_servicio_id,
    p_fecha, p_hora_inicio, v_hora_fin, v_duracion, 'AGENDADO'
  )
  RETURNING * INTO v_cita;

  RETURN v_cita;
END;
$$;

CREATE OR REPLACE FUNCTION public.reagendar_cita_segura(
  p_user_id uuid,
  p_cliente_id text,
  p_cita_id uuid,
  p_fecha date,
  p_hora_inicio time without time zone
)
RETURNS public.citas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cita public.citas%ROWTYPE;
  v_duracion integer;
  v_hora_fin time without time zone;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT *
    INTO v_cita
    FROM public.citas
   WHERE id = p_cita_id
     AND user_id = p_user_id
     AND cliente_id::text = p_cliente_id
     AND UPPER(BTRIM(COALESCE(estado, ''))) IN ('AGENDADO', 'AGENDADA', 'PENDIENTE', 'EN_ESPERA')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró una cita activa para este enlace';
  END IF;

  SELECT COALESCE(v_cita.duracion_servicio, s.duracion_minutos)
    INTO v_duracion
    FROM public.servicios s
   WHERE s.id = v_cita.servicio_id AND s.user_id = p_user_id;
  IF NOT FOUND OR v_duracion IS NULL OR v_duracion <= 0 THEN
    RAISE EXCEPTION 'No se pudo determinar la duración del servicio';
  END IF;

  v_hora_fin := public.validar_disponibilidad_cita(p_user_id, p_fecha, p_hora_inicio, v_duracion, p_cita_id);

  UPDATE public.citas
     SET fecha_inicio = p_fecha,
         hora_inicio = p_hora_inicio,
         hora_fin = v_hora_fin,
         duracion_servicio = v_duracion,
         estado = 'AGENDADO'
   WHERE id = p_cita_id
  RETURNING * INTO v_cita;

  RETURN v_cita;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_disponibilidad_cita(uuid, date, time without time zone, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_cita_segura(uuid, uuid, text, text, text, date, time without time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reagendar_cita_segura(uuid, text, uuid, date, time without time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_cita_segura(uuid, uuid, text, text, text, date, time without time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.reagendar_cita_segura(uuid, text, uuid, date, time without time zone) TO service_role;

COMMIT;
