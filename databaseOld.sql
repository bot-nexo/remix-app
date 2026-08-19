--mostrar zona horaria
SHOW timezone;

--mostrar hora actual
SELECT
  NOW();

--cambiar zona horaria
ALTER DATABASE postgres SET timezone TO 'America/Bogota';

---------------------------------------
CREATE TABLE empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  nombre text NOT NULL,
  direccion text NOT NULL,
  horario text,
  politicas text,
  color_primario text DEFAULT '#0084ffff',
  color_secundario text DEFAULT '#7c7c7cff',
  logo_url text,
  google_access_token text,
  google_refresh_token text,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  nombre text NOT NULL,
  valor numeric(10,2) NOT NULL,
  duracion_minutos int NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lista_blanca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  nombre_contacto text NOT NULL,
  numero_whatsapp text NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  cliente_nombre text,
  cliente_numero text,
  servicio_id uuid REFERENCES servicios(id),
  fecha_inicio TIMESTAMPTZ,
  estado text DEFAULT 'agendada',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, clave)
);

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;

ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

ALTER TABLE lista_blanca ENABLE ROW LEVEL SECURITY;

ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas previas si existieran (para evitar duplicados)
DROP POLICY IF EXISTS "Acceso total a empresa para usuarios autenticados" ON empresa;

DROP POLICY IF EXISTS "Acceso total a servicios para usuarios autenticados" ON servicios;

DROP POLICY IF EXISTS "Acceso total a lista_blanca para usuarios autenticados" ON lista_blanca;

DROP POLICY IF EXISTS "Acceso total a citas para usuarios autenticados" ON citas;

DROP POLICY IF EXISTS "Usuarios gestionan sus configuraciones" ON configuracion;

-- 3. Crear Políticas de Seguridad (Solo usuarios autenticados pueden consultar, crear, modificar y borrar)
-- Política para 'empresa'
CREATE POLICY "Acceso total a empresa para usuarios autenticados" ON empresa FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Política para 'servicios'
CREATE POLICY "Acceso total a servicios para usuarios autenticados" ON servicios FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Política para 'lista_blanca'
CREATE POLICY "Acceso total a lista_blanca para usuarios autenticados" ON lista_blanca FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Política para 'citas'
CREATE POLICY "Acceso total a citas para usuarios autenticados" ON citas FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios gestionan sus configuraciones" ON configuracion FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-----------------------------
-----------------------------
-----------------------------
-- 1. Crear el bucket 'empresa' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('empresa', 'empresa', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar la política para ver imágenes públicas
CREATE POLICY "Logos públicos" ON storage.objects FOR SELECT
USING (bucket_id = 'empresa');

-- 3. Permitir subir archivos con un límite de 3 objetos por usuario
CREATE POLICY "Permitir subir máximo 3 logos por usuario" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'empresa' AND auth.role() = 'authenticated' AND ( SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'empresa' AND (storage.foldername(name))[1] = auth.uid()::text ) < 3 );

-- 4. Permitir actualizar y eliminar sus propios archivos
CREATE POLICY "Permitir modificar sus logos" ON storage.objects FOR UPDATE
USING (bucket_id = 'empresa' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Permitir eliminar sus logos" ON storage.objects FOR DELETE
USING (bucket_id = 'empresa' AND (storage.foldername(name))[1] = auth.uid()::text);

--------------------
--------------------
--------------------
-- 1. TABLA: horario_atencion (Horario semanal estándar de la profesional)
CREATE TABLE horario_atencion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  -- 0=Domingo, 1=Lunes, ..., 6=Sábado
 hora_inicio TIME NOT NULL,
  -- ej. '08:00:00'
 hora_fin TIME NOT NULL,
  -- ej. '17:00:00'
 activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dia_semana)
);

-- 2. TABLA: bloqueos_agenda (Para imprevistos, citas médicas o días no laborables)
CREATE TABLE bloqueos_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME,
  -- NULL si es el día completo
 hora_fin TIME,
  -- NULL si es el día completo
 bloqueo_completo BOOLEAN DEFAULT FALSE,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. HABILITAR RLS
ALTER TABLE horario_atencion ENABLE ROW LEVEL SECURITY;

ALTER TABLE bloqueos_agenda ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURIDAD (Acceso total para la profesional autenticada)
CREATE POLICY "Acceso total a horario_atencion" ON horario_atencion FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Acceso total a bloqueos_agenda" ON bloqueos_agenda FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);