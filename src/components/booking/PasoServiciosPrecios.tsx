
import { obtenerServiciosActivos } from '@/src/services/serviciosService';
import { Servicio } from '@/src/types/types';
import { Clock3, Crown, RefreshCw, Scissors, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import BackButton from '../ui/BackButton';


interface Props {
  onVolver: () => void;
}

function formatearPrecio(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function PasoServiciosPrecios({ onVolver }: Props) {

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarServicios();
  }, []);

  const cargarServicios = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await obtenerServiciosActivos();
      if (data.length > 0) {
        setServicios(data);
      } else {
        setError("No se pudo cargar los servicios");
      }

    } catch (err) {
      console.error(err);
      setError('No pudimos cargar los servicios.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5 pb-4">
      <BackButton text="Volver al Menú Principal" onClick={onVolver} />

      <div className="space-y-4">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-[var(--brand-blush)]/20 p-5 shadow-2xl shadow-black/30" style={{ background: 'linear-gradient(135deg, var(--brand-ink) 0%, color-mix(in srgb, var(--brand-ink) 72%, #120d14) 58%, color-mix(in srgb, var(--brand-secondary) 42%, #30201b) 100%)' }}>
          <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rotate-12 border border-[var(--brand-blush)]/20 bg-[var(--brand-blush)]/5" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full border border-[var(--brand-gold)]/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="max-w-[17rem]">
              <div className="flex items-center gap-2 text-[var(--brand-gold)]">
                <Crown size={14} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Angel Nails · La colección</p>
              </div>
              <h2 className="mt-4 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#fff5f7]">Un acabado que se nota.</h2>
              <p className="mt-3 text-xs leading-relaxed text-[#d8c4c9]">Descubre nuestros rituales de cuidado, color y diseño. Tu próximo look empieza con una elección.</p>
            </div>
            <div className="relative mt-1 flex h-14 w-10 shrink-0 items-end justify-center rounded-b-[1.5rem] rounded-t-[1.5rem] border border-[var(--brand-blush)]/40 bg-gradient-to-b from-[var(--brand-blush)] via-[var(--brand-primary)] to-[var(--brand-secondary)] shadow-[0_8px_20px_rgba(198,109,141,0.3)]">
              <span className="mb-2 h-1.5 w-1.5 rounded-full bg-white/80" />
            </div>
          </div>
          <div className="relative mt-6 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-[#cdb9be]">
            <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-[var(--brand-gold)]" /> Diseñado para ti</span>
            <span>{servicios.length || '—'} servicios activos</span>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
            <RefreshCw className="mx-auto mb-3 animate-spin text-[var(--brand-primary)]" size={22} />
            <p className="text-sm text-slate-400">Preparando la colección...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-10 text-center">
            <p className="text-sm text-rose-200">{error}</p>
            <button type="button" onClick={cargarServicios} className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-300/30 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/10">
              <RefreshCw size={13} /> Intentar de nuevo
            </button>
          </div>
        ) : servicios.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-400">No hay servicios disponibles en este momento.</p>
        ) : (
          <div className="space-y-3">
            {servicios.map((servicio, index) => (
              <div
                key={servicio.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--brand-ink)]/90 p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-blush)]/40 hover:bg-[var(--brand-secondary)]/40"
              >
                <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--brand-blush)] via-[var(--brand-primary)] to-[var(--brand-gold)] opacity-70" />
                <div className="flex min-w-0 items-start gap-3 pr-2">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-[#b999a4]">{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--brand-blush)]/20 bg-[var(--brand-blush)]/10 text-[var(--brand-blush)]"><Scissors size={15} /></span>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="break-words font-semibold leading-snug text-[#fff5f7]">{servicio.nombre}</h3>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-300/75"><Clock3 size={13} className="text-[var(--brand-gold)]" /> {servicio.duracion_minutos} minutos</p>
                  </div>
                </div>

                <div className="shrink-0 self-center pr-2 text-right">
                  <span className="block text-base font-bold text-[var(--brand-blush)]">{formatearPrecio(Number(servicio.valor))}</span>
                  <span className="mt-1 block text-[9px] uppercase tracking-[0.14em] text-slate-400">por servicio</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
