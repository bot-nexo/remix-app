import { MessageCircle, ShieldCheck, Sparkles, Lock, ArrowUpRight } from 'lucide-react';
import { EmpresaConfig } from '../../types/types';

interface Props {
  empresa: EmpresaConfig | null;
  telefonoProfesional?: string;
  colorPrimario?: string;
  colorSecundario?: string;
}

export default function AccesoSeguroWhatsApp({
  empresa,
  telefonoProfesional = '',
  colorPrimario = '#C96F8D',
  colorSecundario = '#7B3F54',
}: Props) {
  const cleanPhone = (telefonoProfesional || '').replace(/\D/g, '');
  // Si no hay teléfono específico, usar número formateado para WhatsApp
  const targetPhone = cleanPhone || '573001234567';
  const waText = encodeURIComponent('Hola, deseo acceder a mis reservas');
  const waLink = `https://wa.me/${targetPhone}?text=${waText}`;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#130d11] px-4 py-10 text-white selection:bg-white/10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1a1217] p-6 sm:p-8 shadow-2xl relative">
        {/* Glow de fondo decorativo */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-30"
          style={{ background: colorPrimario }}
        />
        <div
          className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full blur-3xl opacity-20"
          style={{ background: colorSecundario }}
        />

        <div className="relative text-center">
          {/* Logo o Badge de la empresa */}
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre}
              className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-xl ring-2 ring-white/10"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-xl ring-2 ring-white/10"
              style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
            >
              {empresa?.nombre?.charAt(0) || 'A'}
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 mb-3">
            <ShieldCheck size={14} />
            <span>Acceso Privado e Identidad Verificada</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            {empresa?.nombre || 'Angel Nails'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Para proteger tus citas, historial y privacidad, el acceso a la agenda se realiza mediante tu enlace personal de WhatsApp.
          </p>

          {/* Tarjeta de instrucciones */}
          <div className="my-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left space-y-3">
            <div className="flex items-start gap-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                1
              </div>
              <p>Toca el botón verde abajo para abrir WhatsApp con nuestro asistente virtual.</p>
            </div>
            <div className="flex items-start gap-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                2
              </div>
              <p>Envía el mensaje y recibirás de inmediato tu **enlace personal único** sin duplicar tus citas.</p>
            </div>
          </div>

          {/* Botón Principal a WhatsApp */}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-500 active:scale-[0.98]"
          >
            <MessageCircle size={20} className="fill-current" />
            <span>Solicitar mi Enlace por WhatsApp</span>
            <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock size={12} />
            <span>Sin contraseñas · Seguro y en tiempo real</span>
          </div>
        </div>
      </div>
    </main>
  );
}
