
import { useEffect, useState } from 'react';
import BackButton from '../ui/BackButton';
import { obtenerServiciosActivos } from '@/src/services/serviciosService';
import { Servicio } from '@/src/types/types';


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

      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Catálogo de Servicios</h2>
          <p className="text-xs text-slate-400 mt-1">
            Consulta nuestros servicios, precios y duración estimada
          </p>
        </div>

        {servicios.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4">
            No hay servicios disponibles en este momento.
          </p>
        ) : (
          <div className="space-y-3">
            {servicios.map((servicio) => (
              <div
                key={servicio.id}
                className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 transition"
              >
                <div>
                  <h3 className="font-semibold text-slate-100">{servicio.nombre}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ⏱️ {servicio.duracion_minutos} minutos
                  </p>
                </div>

                <span
                  className="text-base font-bold"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {formatearPrecio(Number(servicio.valor))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}