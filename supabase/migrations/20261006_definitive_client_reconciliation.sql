-- =============================================================================
-- Migración: Reconciliación Definitiva Anti-Duplicidad de Clientes (LID <-> Número)
-- Fecha: 06/10/2026
-- =============================================================================

-- 1. ELIMINAR EL TRIGGER CONFLICTIVO DE CLIENTES
DROP TRIGGER IF EXISTS trg_reconcile_cliente ON public.clientes;
DROP FUNCTION IF EXISTS public.trigger_reconcile_cliente_before_insert();

-- 2. CORREGIR NÚMEROS QUE SE GUARDARON EN LA COLUMNA LID POR ERROR
UPDATE public.clientes
SET numero = lid, lid = NULL
WHERE (lid IS NOT NULL AND LENGTH(REGEXP_REPLACE(lid, '\D', '', 'g')) <= 12)
  AND (numero IS NULL OR numero = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes c2 WHERE c2.numero = REGEXP_REPLACE(clientes.lid, '\D', '', 'g')
  );

-- 3. FUSIÓN Y LIMPIEZA DE CLIENTES DUPLICADOS (CON LIBERACIÓN PREVIA DE LLAVES)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT c_lid.id AS lid_client_id, c_num.id AS num_client_id, c_lid.lid AS lid_val
    FROM public.clientes c_lid
    JOIN public.clientes c_num ON c_lid.id != c_num.id
    WHERE c_lid.numero IS NULL 
      AND c_lid.lid IS NOT NULL
      AND c_num.numero IS NOT NULL
      AND (
        LOWER(TRIM(c_lid.nombre)) = LOWER(TRIM(c_num.nombre))
        OR RIGHT(c_num.numero, 10) = RIGHT(c_lid.lid, 10)
      )
  LOOP
    -- A. Liberar el LID del registro viejo para no chocar con la restricción UNIQUE
    UPDATE public.clientes 
    SET lid = NULL 
    WHERE id = rec.lid_client_id;

    -- B. Asignar el LID al cliente con número
    UPDATE public.clientes 
    SET lid = rec.lid_val
    WHERE id = rec.num_client_id AND (lid IS NULL OR lid = '');

    -- C. Re-apuntar citas
    UPDATE public.citas 
    SET cliente_id = rec.num_client_id 
    WHERE cliente_id = rec.lid_client_id;

    -- D. Re-apuntar conversacion_estado
    UPDATE public.conversacion_estado 
    SET cliente_id = rec.num_client_id::text 
    WHERE cliente_id = rec.lid_client_id::text;

    -- E. Eliminar la fila duplicada
    DELETE FROM public.clientes WHERE id = rec.lid_client_id;
  END LOOP;
END $$;

-- 4. CREAR LA FUNCIÓN RPC ATÓMICA DE RECONCILIACIÓN
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
  -- Normalizar teléfono colombiano (10 dígitos a 573...)
  IF p_telefono IS NOT NULL AND TRIM(p_telefono) != '' THEN
    v_clean_phone := REGEXP_REPLACE(p_telefono, '\D', '', 'g');
    IF LENGTH(v_clean_phone) = 10 AND v_clean_phone LIKE '3%' THEN
      v_full_phone := '57' || v_clean_phone;
    ELSIF LENGTH(v_clean_phone) >= 7 THEN
      v_full_phone := v_clean_phone;
    END IF;
  END IF;

  -- Normalizar LID (solo si tiene >= 14 dígitos de privacidad Meta)
  IF p_lid IS NOT NULL AND TRIM(p_lid) != '' THEN
    v_clean_lid := REGEXP_REPLACE(p_lid, '\D', '', 'g');
    IF LENGTH(v_clean_lid) < 14 AND v_full_phone IS NULL THEN
      v_full_phone := v_clean_lid;
      v_clean_lid := NULL;
    END IF;
  END IF;

  v_nombre_final := COALESCE(NULLIF(TRIM(p_nombre), ''), 'Cliente');

  -- 1. Búsqueda por ID explícito
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_id LIMIT 1;
  END IF;

  -- 2. Búsqueda por Teléfono si no se encontró por ID
  IF v_cliente.id IS NULL AND v_full_phone IS NOT NULL THEN
    SELECT * INTO v_cliente 
    FROM public.clientes 
    WHERE numero = v_full_phone 
       OR (LENGTH(v_full_phone) >= 10 AND numero LIKE '%' || RIGHT(v_full_phone, 10))
    LIMIT 1;
  END IF;

  -- 3. Búsqueda por LID si no se encontró por Teléfono
  IF v_cliente.id IS NULL AND v_clean_lid IS NOT NULL THEN
    SELECT * INTO v_cliente FROM public.clientes WHERE lid = v_clean_lid LIMIT 1;
  END IF;

  -- 4. Si el cliente ya existe: Actualizar / Reconciliar datos faltantes
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

  -- 5. Si no existe en lo absoluto: Insertar nuevo registro
  INSERT INTO public.clientes (nombre, numero, lid)
  VALUES (v_nombre_final, v_full_phone, v_clean_lid)
  RETURNING * INTO v_cliente;

  RETURN v_cliente;
END;
$$;
