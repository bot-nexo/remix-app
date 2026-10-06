-- Asegurar que la tabla conversacion_estado sea accesible libremente por la API del bot
ALTER TABLE public.conversacion_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total conversacion_estado" ON public.conversacion_estado;

CREATE POLICY "Acceso total conversacion_estado"
  ON public.conversacion_estado
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL PRIVILEGES ON TABLE public.conversacion_estado TO anon, authenticated, service_role;
