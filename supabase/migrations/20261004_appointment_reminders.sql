-- Migración para soporte de recordatorios automáticos de citas por WhatsApp
ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS recordatorio_24h_enviado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_2h_enviado boolean DEFAULT false;
