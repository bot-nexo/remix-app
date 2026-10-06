-- 1. Reparar todas las citas existentes que tengan cliente_id como NULL haciendo match por número telefónico
UPDATE public.citas c
SET cliente_id = cl.id
FROM public.clientes cl
WHERE c.cliente_id IS NULL
  AND c.cliente_numero IS NOT NULL
  AND (
    cl.numero = c.cliente_numero 
    OR REGEXP_REPLACE(cl.numero, '\D', '', 'g') = REGEXP_REPLACE(c.cliente_numero, '\D', '', 'g')
  );

-- 2. Asegurar que en el RPC de reserva online no se permita cliente_id vacio
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
