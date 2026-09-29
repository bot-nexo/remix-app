
import { obtenerServiciosActivos } from '@/src/services/serviciosService';
import { Servicio } from '@/src/types/types';
import { Clock3, Scissors, Sparkles } from 'lucide-react';
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

  //******************************* */
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

  //****************************** */
  return (
    <section className="space-y-4">
      <BackButton text="Volver al Menú Principal" onClick={onVolver} />

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Nuestra carta</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-100">Servicios para tu próximo momento.</h2>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">Elige con calma. Aquí encuentras precios transparentes y el tiempo estimado de cada servicio.</p>
            </div>
            <Sparkles className="mt-1 shrink-0 text-[var(--brand-primary)]" size={20} />
          </div>
        </div>

        {servicios.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-400">
            No hay servicios disponibles en este momento.
          </p>
        ) : (
          <div className="space-y-3">
            {servicios.map((servicio) => (
              <div
                key={servicio.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-800/80"
              >
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"><Scissors size={14} /></span>
                    <h3 className="truncate font-semibold text-slate-100">{servicio.nombre}</h3>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock3 size={13} /> {servicio.duracion_minutos} minutos
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="block text-base font-bold" style={{ color: 'var(--brand-primary)' }}>{formatearPrecio(Number(servicio.valor))}</span>
                  <span className="text-[10px] text-slate-500">por servicio</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
