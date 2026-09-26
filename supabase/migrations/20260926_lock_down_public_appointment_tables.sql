BEGIN;

ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversacion_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes pueden crear citas" ON public.citas;
DROP POLICY IF EXISTS "Clientes pueden leer sus propias citas por cliente_id" ON public.citas;
DROP POLICY IF EXISTS "Clientes pueden cancelar sus citas" ON public.citas;
DROP POLICY IF EXISTS "Acceso total para la gestion de clientes" ON public.clientes;
DROP POLICY IF EXISTS "Acceso total para la gestion del flujo de conversacion" ON public.conversacion_estado;

REVOKE ALL PRIVILEGES ON TABLE public.citas, public.clientes, public.conversacion_estado FROM anon;
GRANT ALL PRIVILEGES ON TABLE public.citas, public.clientes, public.conversacion_estado TO service_role;

COMMIT;
