import React, { useState } from 'react';
import { MessageCircle, ShieldCheck, Lock, Sparkles, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { EmpresaConfig } from '../../types/types';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  empresa: EmpresaConfig | null;
  telefonoProfesional?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  onAccesoConcedido?: (access: { id: string; token: string }) => void;
}

const AUTORESPONDER_URL = import.meta.env.DEV
  ? '/autoresponder-api'
  : import.meta.env.VITE_AUTORESPONDER_URL || '';

export default function AccesoSeguroWhatsApp({
  empresa,
  telefonoProfesional = '',
  colorPrimario = '#C96F8D',
  colorSecundario = '#7B3F54',
  onAccesoConcedido,
}: Props) {
  const { showToast } = useToast();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarWaFallback, setMostrarWaFallback] = useState(false);

  const cleanPhone = (telefonoProfesional || '').replace(/\D/g, '');
  const waText = encodeURIComponent('Hola, deseo acceder a mis reservas');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : '#';

  const handleIngresoDirecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono.trim() || telefono.replace(/\D/g, '').length < 7) {
      showToast('Ingresa un número de WhatsApp válido.', 'warning');
      return;
    }

    setCargando(true);
    try {
      if (AUTORESPONDER_URL) {
        const res = await fetch(`${AUTORESPONDER_URL.replace(/\/$/, '')}/api/verify-or-create-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.id && data.token) {
            const accessObj = { id: data.id, token: data.token };
            sessionStorage.setItem('booking_access', JSON.stringify(accessObj));
            showToast('¡Ingreso exitoso! Bienvenido a la agenda.', 'success');
            if (onAccesoConcedido) {
              onAccesoConcedido(accessObj);
            } else {
              window.location.reload();
            }
            return;
          }
        }
      }

      // Si no responde el servidor de WhatsApp o falló, ofrecemos el enlace de WhatsApp
      setMostrarWaFallback(true);
      showToast('No se pudo verificar automáticamente. Puedes solicitar tu enlace vía WhatsApp.', 'warning');
    } catch (err: any) {
      console.error('Error al ingresar directamente:', err);
      setMostrarWaFallback(true);
      showToast('No se pudo conectar con el servidor. Intenta vía WhatsApp.', 'warning');
    } finally {
      setCargando(false);
    }
  };

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
            <span>Acceso Privado a Agenda</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            {empresa?.nombre || 'Angel Nails'}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            Ingresa tus datos para agendar o gestionar tu cita al instante.
          </p>

          {/* Formulario de Ingreso Directo por WhatsApp */}
          <form onSubmit={handleIngresoDirecto} className="my-6 text-left space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/10">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <User size={13} className="text-pink-400" /> Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Carolina Pérez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Phone size={13} className="text-emerald-400" /> Número de WhatsApp <span className="text-pink-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 300 123 4567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
            >
              {cargando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a la Agenda</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Opción Secundaria: Abrir por WhatsApp si prefiere */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setMostrarWaFallback(!mostrarWaFallback)}
              className="text-[11px] text-slate-400 hover:text-white underline font-medium"
            >
              {mostrarWaFallback ? 'Ocultar opción de WhatsApp' : '¿Prefieres solicitar tu enlace por WhatsApp?'}
            </button>

            {mostrarWaFallback && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-left space-y-2">
                <p className="text-[11px] text-emerald-300">
                  Si ya chateaste antes con el bot, puedes abrir WhatsApp para recibir tu enlace directo de acceso:
                </p>
                <a
                  href={waLink}
                  target={cleanPhone ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:underline"
                >
                  <MessageCircle size={15} />
                  <span>Abrir WhatsApp con el negocio</span>
                </a>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock size={12} />
            <span>Sin contraseñas · Seguro y en tiempo real</span>
          </div>

          <p className="mt-5 text-[10px] text-slate-400">
            Creado con <span className="text-rose-400">❤️</span> por{' '}
            <a
              href="https://nexodevstudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-200 underline decoration-slate-500/50 underline-offset-2 hover:text-white"
            >
              NexoDevStudio
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
