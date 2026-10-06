-- =============================================================================
-- Migración: Reconciliación y Fusión de Clientes Duplicados (LID <-> Número)
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 1. Fusionar clientes donde una fila tiene LID (sin número) y otra tiene Número (mismo nombre o teléfono)
  FOR rec IN 
    SELECT c_lid.id AS lid_client_id, c_num.id AS num_client_id, c_lid.lid AS lid_val, c_num.numero AS num_val
    FROM clientes c_lid
    JOIN clientes c_num ON c_lid.id != c_num.id
    WHERE c_lid.numero IS NULL 
      AND c_lid.lid IS NOT NULL
      AND c_num.numero IS NOT NULL
      AND (
        LOWER(TRIM(c_lid.nombre)) = LOWER(TRIM(c_num.nombre))
        OR RIGHT(c_num.numero, 10) = RIGHT(c_lid.lid, 10)
      )
  LOOP
    -- Consolidar LID en el cliente con número (num_client_id)
    UPDATE clientes 
    SET lid = rec.lid_val
    WHERE id = rec.num_client_id AND (lid IS NULL OR lid = '');

    -- Re-apuntar citas asociadas al cliente antiguo
    UPDATE citas 
    SET cliente_id = rec.num_client_id 
    WHERE cliente_id = rec.lid_client_id;

    -- Re-apuntar estado de conversación
    UPDATE conversacion_estado 
    SET cliente_id = rec.num_client_id 
    WHERE cliente_id = rec.lid_client_id;

    -- Re-apuntar lista blanca
    UPDATE lista_blanca 
    SET cliente_id = rec.num_client_id 
    WHERE cliente_id = rec.lid_client_id;

    -- Eliminar la fila duplicada que solo tenía LID
    DELETE FROM clientes WHERE id = rec.lid_client_id;
  END LOOP;
END $$;

-- 2. Crear función de la base de datos para prevenir duplicados en INSERT directos
CREATE OR REPLACE FUNCTION trigger_reconcile_cliente_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- A. Si trae número, buscar si ya existe un cliente por número
  IF NEW.numero IS NOT NULL AND NEW.numero != '' THEN
    SELECT id INTO existing_id FROM clientes WHERE numero = NEW.numero LIMIT 1;
    IF existing_id IS NOT NULL THEN
      IF NEW.lid IS NOT NULL THEN
        UPDATE clientes SET lid = NEW.lid WHERE id = existing_id AND (lid IS NULL OR lid = '');
      END IF;
      RETURN NULL; -- Cancelar INSERT duplicado
    END IF;
  END IF;

  -- B. Si trae LID, buscar si ya existe un cliente por LID
  IF NEW.lid IS NOT NULL AND NEW.lid != '' THEN
    SELECT id INTO existing_id FROM clientes WHERE lid = NEW.lid LIMIT 1;
    IF existing_id IS NOT NULL THEN
      IF NEW.numero IS NOT NULL THEN
        UPDATE clientes SET numero = NEW.numero WHERE id = existing_id AND (numero IS NULL OR numero = '');
      END IF;
      RETURN NULL; -- Cancelar INSERT duplicado
    END IF;
  END IF;

  -- C. Si trae número pero no se encontró por número ni LID, buscar si existe cliente sin número con mismo nombre
  IF NEW.numero IS NOT NULL AND NEW.numero != '' AND NEW.nombre IS NOT NULL AND LOWER(TRIM(NEW.nombre)) NOT IN ('cliente whatsapp', 'cliente directo') THEN
    SELECT id INTO existing_id 
    FROM clientes 
    WHERE numero IS NULL 
      AND LOWER(TRIM(nombre)) = LOWER(TRIM(NEW.nombre)) 
    ORDER BY created_at DESC 
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE clientes 
      SET numero = NEW.numero,
          lid = COALESCE(lid, NEW.lid)
      WHERE id = existing_id;
      RETURN NULL; -- Cancelar INSERT duplicado
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el Trigger BEFORE INSERT en clientes
DROP TRIGGER IF EXISTS trg_reconcile_cliente ON clientes;

CREATE TRIGGER trg_reconcile_cliente
BEFORE INSERT ON clientes
FOR EACH ROW
EXECUTE FUNCTION trigger_reconcile_cliente_before_insert();
