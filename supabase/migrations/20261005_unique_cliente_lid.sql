-- Migración para asegurar unicidad de LID y Teléfono en la tabla de clientes
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_lid_key UNIQUE (lid);
