-- =============================================================================
-- ESQUEMA MAESTRO CANÓNICO DE BASE DE DATOS (SUPABASE / POSTGRESQL)
-- Proyecto: Angel Nails — Sistema de Reservas & Bot Autoresponder
-- Versión: 2.1 (Actualizado 06/10/2026)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABLA: EMPRESA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  nombre text NOT NULL,
  direccion text NOT NULL,
  horario text,
  politicas text,
  nom_bot text DEFAULT 'Mia'::text,
  color_primario text DEFAULT '#2563eb'::text,
  color_secundario text DEFAULT '#1e40af'::text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT empresa_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 2. TABLA: SERVICIOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  duracion_minutos integer NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT servicios_pkey PRIMARY KEY (id),
  CONSTRAINT servicios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 3. TABLA: LISTA_BLANCA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lista_blanca (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_contacto text NOT NULL,
  numero_whatsapp text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT lista_blanca_pkey PRIMARY KEY (id),
  CONSTRAINT lista_blanca_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT lista_blanca_user_numero_key UNIQUE (user_id, numero_whatsapp)
);

-- -----------------------------------------------------------------------------
-- 4. TABLA: CLIENTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  numero text,
  lid text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_numero_key UNIQUE (numero),
  CONSTRAINT clientes_lid_key UNIQUE (lid)
);

-- -----------------------------------------------------------------------------
-- 5. TABLA: CITAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_id uuid,
  cliente_nombre text,
  cliente_numero text,
  servicio_id uuid,
  fecha_inicio date,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  duracion_servicio bigint,
  estado text DEFAULT 'agendada'::text,
  recordatorio_24h_enviado boolean DEFAULT false,
  recordatorio_2h_enviado boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT citas_pkey PRIMARY KEY (id),
  CONSTRAINT citas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT citas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE SET NULL,
  CONSTRAINT citas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 6. TABLA: CONFIGURACION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clave text NOT NULL,
  valor text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT configuracion_pkey PRIMARY KEY (id),
  CONSTRAINT configuracion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT configuracion_user_clave_key UNIQUE (user_id, clave)
);

-- -----------------------------------------------------------------------------
-- 7. TABLA: HORARIO_ATENCION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.horario_atencion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  dia_semana integer,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT horario_atencion_pkey PRIMARY KEY (id),
  CONSTRAINT horario_atencion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT horario_atencion_user_id_fecha_key UNIQUE (user_id, fecha)
);

-- -----------------------------------------------------------------------------
-- 8. TABLA: BLOQUEOS_AGENDA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bloqueos_agenda (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  bloqueo_completo boolean DEFAULT false,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT bloqueos_agenda_pkey PRIMARY KEY (id),
  CONSTRAINT bloqueos_agenda_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 9. TABLA: CONVERSACION_ESTADO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversacion_estado (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telefono text NOT NULL,
  estado text NOT NULL DEFAULT 'MENU_PRINCIPAL'::text,
  servicio_id uuid,
  fecha date,
  hora time without time zone,
  hora_fin time without time zone,
  duracion_servicio bigint,
  cita_id uuid,
  cliente_id text,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT conversacion_estado_pkey PRIMARY KEY (id),
  CONSTRAINT conversacion_estado_telefono_key UNIQUE (telefono),
  CONSTRAINT conversacion_estado_servicio_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE SET NULL,
  CONSTRAINT conversacion_estado_cita_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id) ON DELETE SET NULL
);

-- =============================================================================
-- FUNCIONES RPC ATÓMICAS Y PROCEDIMIENTOS ALMACENADOS
-- =============================================================================

-- 1. RECONCILIACIÓN Y CREACIÓN DE CLIENTES (ANTI-DUPLICIDAD)
CREATE OR REPLACE FUNCTION public.reconciliar_o_crear_cliente(
  p_id uuid DEFAULT NULL,
  p_nombre text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_lid text DEFAULT NULL
)
RETURNS public.clientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone text;
  v_full_phone text;
  v_clean_lid text;
  v_cliente public.clientes%ROWTYPE;
  v_nombre_final text;
BEGIN
  IF p_telefono IS NOT NULL AND TRIM(p_telefono) != '' THEN
    v_clean_phone := REGEXP_REPLACE(p_telefono, '\D', '', 'g');
    IF LENGTH(v_clean_phone) = 10 AND v_clean_phone LIKE '3%' THEN
      v_full_phone := '57' || v_clean_phone;
    ELSIF LENGTH(v_clean_phone) >= 7 THEN
      v_full_phone := v_clean_phone;
    END IF;
  END IF;

  IF p_lid IS NOT NULL AND TRIM(p_lid) != '' THEN
    v_clean_lid := REGEXP_REPLACE(p_lid, '\D', '', 'g');
    IF LENGTH(v_clean_lid) < 14 AND v_full_phone IS NULL THEN
      v_full_phone := v_clean_lid;
      v_clean_lid := NULL;
    END IF;
  END IF;

  v_nombre_final := COALESCE(NULLIF(TRIM(p_nombre), ''), 'Cliente');

  -- Búsqueda multinivel
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_id LIMIT 1;
  END IF;

  IF v_cliente.id IS NULL AND v_full_phone IS NOT NULL THEN
    SELECT * INTO v_cliente 
    FROM public.clientes 
    WHERE numero = v_full_phone 
       OR (LENGTH(v_full_phone) >= 10 AND numero LIKE '%' || RIGHT(v_full_phone, 10))
    LIMIT 1;
  END IF;

  IF v_cliente.id IS NULL AND v_clean_lid IS NOT NULL THEN
    SELECT * INTO v_cliente FROM public.clientes WHERE lid = v_clean_lid LIMIT 1;
  END IF;

  -- Reconciliar o Insertar
  IF v_cliente.id IS NOT NULL THEN
    UPDATE public.clientes
    SET 
      numero = COALESCE(v_cliente.numero, v_full_phone),
      lid = COALESCE(v_cliente.lid, v_clean_lid),
      nombre = CASE 
        WHEN v_cliente.nombre IN ('Cliente', 'Cliente WhatsApp', 'Cliente Directo', '') AND v_nombre_final NOT IN ('Cliente', 'Cliente WhatsApp', 'Cliente Directo') 
        THEN v_nombre_final 
        ELSE v_cliente.nombre 
      END
    WHERE id = v_cliente.id
    RETURNING * INTO v_cliente;

    RETURN v_cliente;
  END IF;

  INSERT INTO public.clientes (nombre, numero, lid)
  VALUES (v_nombre_final, v_full_phone, v_clean_lid)
  RETURNING * INTO v_cliente;

  RETURN v_cliente;
END;
$$;

-- 2. VALIDACIÓN DE DISPONIBILIDAD
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

-- 3. RESERVA DE CITA SEGURA
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
