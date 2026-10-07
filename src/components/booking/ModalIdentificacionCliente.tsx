import { Phone, User, ArrowRight } from 'lucide-react';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onIdentificar: (telefono: string, nombre: string) => Promise<void>;
  colorPrimario?: string;
}

export default function ModalIdentificacionCliente({ onIdentificar, colorPrimario = 'var(--brand-primary)' }: Props) {
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanNum = telefono.replace(/\D/g, '');
    if (!cleanNum || cleanNum.length < 7) {
      setErrorMsg('Ingresa un número de WhatsApp válido.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      await onIdentificar(cleanNum, nombre.trim());
    } catch (err: any) {
      setErrorMsg(err?.message || 'No pudimos verificar tu número. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] min-h-screen w-screen flex items-start justify-center p-4 pt-10 md:pt-16 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#161019] p-6 shadow-2xl my-auto sm:my-0">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: `${colorPrimario}20`, color: colorPrimario }}
          >
            <Phone size={26} />
          </div>
          <h2 className="text-xl font-bold text-white">Ingresa a Reservas</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Digita tu número de WhatsApp para consultar tu agenda y programar citas en segundos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="whatsapp" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Número de WhatsApp *
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                id="whatsapp"
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3001234567"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10 [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nombreCliente" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Tu Nombre (Opcional)
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                id="nombreCliente"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María Pérez"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10 [color-scheme:dark]"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !telefono.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: telefono.trim() ? colorPrimario : 'rgba(255,255,255,0.05)',
              color: telefono.trim() ? 'white' : 'rgb(100,116,139)',
              cursor: telefono.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Verificando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continuar a la Agenda
                <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
