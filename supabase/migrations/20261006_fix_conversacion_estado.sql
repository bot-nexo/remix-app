-- =============================================================================
-- Migración: Corrección y Blindaje de la tabla conversacion_estado
-- =============================================================================

-- 1. Permitir que telefono sea opcional o text flexible en conversacion_estado
ALTER TABLE public.conversacion_estado ALTER COLUMN telefono DROP NOT NULL;

-- 2. Asegurar que la columna estado sea TEXT estándar para compatibilidad total
DO $$
BEGIN
  -- Si estado es enum estado_conversacion, convertirlo a text
  ALTER TABLE public.conversacion_estado ALTER COLUMN estado TYPE text USING estado::text;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Crear índice único en cliente_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversacion_estado_cliente_id_key'
  ) THEN
    -- Limpiar posibles duplicados de cliente_id antes de crear la restricción
    DELETE FROM public.conversacion_estado a USING public.conversacion_estado b
    WHERE a.id < b.id AND a.cliente_id IS NOT NULL AND a.cliente_id = b.cliente_id;

    ALTER TABLE public.conversacion_estado ADD CONSTRAINT conversacion_estado_cliente_id_key UNIQUE (cliente_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Función RPC atómica para actualizar/consultar estado de conversación
CREATE OR REPLACE FUNCTION public.actualizar_o_crear_conversacion_estado(
  p_cliente_id text,
  p_telefono text,
  p_nuevo_estado text
)
RETURNS public.conversacion_estado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg public.conversacion_estado%ROWTYPE;
BEGIN
  -- Buscar si ya existe por cliente_id o por telefono
  IF p_cliente_id IS NOT NULL AND p_cliente_id != '' THEN
    SELECT * INTO v_reg FROM public.conversacion_estado WHERE cliente_id = p_cliente_id LIMIT 1;
  END IF;

  IF v_reg.id IS NULL AND p_telefono IS NOT NULL AND p_telefono != '' THEN
    SELECT * INTO v_reg FROM public.conversacion_estado WHERE telefono = p_telefono LIMIT 1;
  END IF;

  -- Si existe, actualizar
  IF v_reg.id IS NOT NULL THEN
    UPDATE public.conversacion_estado
    SET 
      estado = p_nuevo_estado,
      telefono = COALESCE(v_reg.telefono, p_telefono),
      cliente_id = COALESCE(v_reg.cliente_id, p_cliente_id),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = v_reg.id
    RETURNING * INTO v_reg;

    RETURN v_reg;
  END IF;

  -- Si no existe, insertar nuevo registro
  INSERT INTO public.conversacion_estado (cliente_id, telefono, estado, updated_at)
  VALUES (p_cliente_id, p_telefono, p_nuevo_estado, CURRENT_TIMESTAMP)
  RETURNING * INTO v_reg;

  RETURN v_reg;
END;
$$;
