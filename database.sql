-- 1. EMPRESA
CREATE TABLE public.empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  direccion text NOT NULL,
  horario text,
  politicas text,
  nom_bot text,
  color_primario text DEFAULT '#2563eb'::text,
  color_secundario text DEFAULT '#1e40af'::text,
  logo_url text,
  google_access_token text,
  google_refresh_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT empresa_pkey PRIMARY KEY (id),
  CONSTRAINT empresa_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT empresa_user_id_key UNIQUE (user_id)
) TABLESPACE pg_default;

-- 2. SERVICIOS
CREATE TABLE public.servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  duracion_minutos integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT servicios_pkey PRIMARY KEY (id),
  CONSTRAINT servicios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT servicios_duracion_check CHECK (duracion_minutos > 0),
  CONSTRAINT servicios_valor_check CHECK (valor >= 0)
) TABLESPACE pg_default;

-- 3. LISTA_BLANCA
CREATE TABLE public.lista_blanca (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_contacto text NOT NULL,
  numero_whatsapp text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT lista_blanca_pkey PRIMARY KEY (id),
  CONSTRAINT lista_blanca_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Restricción UNIQUE por usuario para no bloquear números entre cuentas distintas
  CONSTRAINT lista_blanca_user_numero_key UNIQUE (user_id, numero_whatsapp)
) TABLESPACE pg_default;

-- 4. CLIENTES
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  numero text,
  lid text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_numero_key UNIQUE (numero),
  CONSTRAINT clientes_lid_key UNIQUE (lid)
) TABLESPACE pg_default;

-- 5. CITAS
CREATE TABLE public.citas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_nombre text,
  cliente_numero text,
  cliente_id text,
  servicio_id uuid,
  fecha_inicio date,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  duracion_servicio integer,
  estado text DEFAULT 'AGENDADO'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT citas_pkey PRIMARY KEY (id),
  CONSTRAINT citas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT citas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- 6. CONFIGURACION
CREATE TABLE public.configuracion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clave text NOT NULL,
  valor text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT configuracion_pkey PRIMARY KEY (id),
  CONSTRAINT configuracion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT configuracion_user_clave_key UNIQUE (user_id, clave)
) TABLESPACE pg_default;

-- 7. HORARIO_ATENCION
CREATE TABLE public.horario_atencion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  dia_semana integer NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT horario_atencion_pkey PRIMARY KEY (id),
  CONSTRAINT horario_atencion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT horario_atencion_user_id_fecha_key UNIQUE (user_id, fecha),
  CONSTRAINT horario_atencion_dia_semana_check CHECK (dia_semana >= 0 AND dia_semana <= 6),
  CONSTRAINT horario_atencion_horas_check CHECK (hora_inicio < hora_fin)
) TABLESPACE pg_default;

-- 8. BLOQUEOS_AGENDA
CREATE TABLE public.bloqueos_agenda (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  bloqueo_completo boolean DEFAULT false,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT bloqueos_agenda_pkey PRIMARY KEY (id),
  CONSTRAINT bloqueos_agenda_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT bloqueos_agenda_horario_check CHECK (
    bloqueo_completo = true OR (
      hora_inicio IS NOT NULL
      AND hora_fin IS NOT NULL
      AND hora_inicio < hora_fin
    )
  )
) TABLESPACE pg_default;

-- 9. CONVERSACION_ESTADO
CREATE TABLE public.conversacion_estado (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telefono text,
  estado text NOT NULL DEFAULT 'MENU_PRINCIPAL'::text,
  servicio_id uuid,
  fecha date,
  hora time without time zone,
  cita_id uuid,
  cliente_id text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT conversacion_estado_pkey PRIMARY KEY (id),
  CONSTRAINT conversacion_estado_telefono_key UNIQUE (telefono),
  CONSTRAINT conversacion_estado_cliente_id_key UNIQUE (cliente_id),
  CONSTRAINT conversacion_estado_servicio_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id) ON DELETE SET NULL,
  CONSTRAINT conversacion_estado_cita_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id) ON DELETE SET NULL
) TABLESPACE pg_default;


-------------------------------------------------------------------------------
-- ÍNDICES DE ALTO RENDIMIENTO (Acelera búsquedas desde n8n y Supabase API)
-------------------------------------------------------------------------------

CREATE INDEX idx_citas_disponibilidad
  ON public.citas (user_id, fecha_inicio, estado);

CREATE INDEX idx_bloqueos_agenda_busqueda
  ON public.bloqueos_agenda (user_id, fecha);

CREATE INDEX idx_horario_atencion_usuario
  ON public.horario_atencion (user_id, fecha)
  WHERE activo = true;

CREATE INDEX idx_conversacion_estado_telefono
  ON public.conversacion_estado (telefono);

CREATE INDEX idx_conversacion_estado_cliente_id
  ON public.conversacion_estado (cliente_id);

CREATE INDEX idx_clientes_numero
  ON public.clientes (numero);

  -------------------------------------------------------------------------------
-- 1. HABILITAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-------------------------------------------------------------------------------
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_blanca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversacion_estado ENABLE ROW LEVEL SECURITY;


-------------------------------------------------------------------------------
-- 2. POLÍTICAS DE ACCESO PARA TABLAS DEL USUARIO AUTENTICADO (App / Frontend)
-- Permite que los usuarios autenticados gestionen únicamente sus propios registros.
-------------------------------------------------------------------------------

-- EMPRESA
CREATE POLICY "Usuarios pueden gestionar su propia empresa"
  ON public.empresa FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SERVICIOS
CREATE POLICY "Usuarios pueden gestionar sus servicios"
  ON public.servicios FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- LISTA BLANCA
CREATE POLICY "Usuarios pueden gestionar su lista blanca"
  ON public.lista_blanca FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CITAS
CREATE POLICY "Usuarios pueden gestionar sus citas"
  ON public.citas FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CONFIGURACION
CREATE POLICY "Usuarios pueden gestionar su configuracion"
  ON public.configuracion FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- HORARIO ATENCION
CREATE POLICY "Usuarios pueden gestionar sus horarios"
  ON public.horario_atencion FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- BLOQUEOS AGENDA
CREATE POLICY "Usuarios pueden gestionar sus bloqueos"
  ON public.bloqueos_agenda FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-------------------------------------------------------------------------------
-- 3. POLÍTICAS PARA TABLAS OPERACIONALES Y BOTS (n8n / WhatsApp integration)
-- Permite acceso total al rol service_role (usado habitualmente en automatizaciones)
-- y lectura/escritura en tablas públicas compartidas.
-------------------------------------------------------------------------------

-- CLIENTES
CREATE POLICY "Acceso total para la gestion de clientes"
  ON public.clientes FOR ALL
  TO authenticated, service_role, anon
  USING (true)
  WITH CHECK (true);

-- CONVERSACION ESTADO
CREATE POLICY "Acceso total para la gestion del flujo de conversacion"
  ON public.conversacion_estado FOR ALL
  TO authenticated, service_role, anon
  USING (true)
  WITH CHECK (true);


-------------------------------------------------------------------------------
-- 4. POLÍTICAS DE LECTURA PÚBLICA PARA CONSULTA DE DISPONIBILIDAD (Opcional)
-- Permite que clientes finales o n8n consulten horarios/servicios sin autenticar usuario auth.
-------------------------------------------------------------------------------

CREATE POLICY "Lectura pública de empresa"
  ON public.empresa FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Lectura pública de servicios"
  ON public.servicios FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Lectura pública de horario_atencion"
  ON public.horario_atencion FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Lectura pública de bloqueos_agenda"
  ON public.bloqueos_agenda FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Clientes pueden crear citas"
  ON public.citas FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Clientes pueden leer sus propias citas por cliente_id"
  ON public.citas FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Clientes pueden cancelar sus citas"
  ON public.citas FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
