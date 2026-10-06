-- =============================================================================
-- MIGRACIÓN SUPABASE: CONFIGURACIÓN DE ROL ÚNICO DE SUPERADMIN Y PERMISOS
-- =============================================================================

-- 1. Asegurar que la tabla configuracion pueda almacenar la clave de rol de usuario
INSERT INTO public.configuracion (user_id, clave, valor)
SELECT id, 'user_role', 'superadmin'
FROM auth.users
WHERE email LIKE '%admin%' OR email LIKE '%juanda%' OR email LIKE '%paula%'
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id, clave) DO UPDATE SET valor = 'superadmin';

-- 2. (Opcional) Asignar directamente el metadata role = 'superadmin' al usuario maestro en auth.users
-- Reemplaza 'tu_email@ejemplo.com' por el correo exacto del SuperAdmin maestro:
/*
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"superadmin"'
)
WHERE email = 'admin@angelnails.tech';
*/

-- 3. Crear índice para acelerar consultas de configuración de módulos y roles
CREATE INDEX IF NOT EXISTS idx_configuracion_clave_user ON public.configuracion(clave, user_id);
