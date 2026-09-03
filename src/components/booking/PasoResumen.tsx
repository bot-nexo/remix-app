import BackButton from "../ui/BackButton";
import { CheckCircle } from "lucide-react";

type Servicio = { nombre: string; valor: number; duracion_minutos: number; };
type DatosCliente = { nombre: string; telefono: string; id?: string; };

interface Props {
  servicio: Servicio; fecha: string; hora: string; cliente: DatosCliente;
  guardando: boolean; errorGuardado: string;
  onConfirmar: () => void; onVolver: () => void;
  formatearPrecio: (valor: number) => string;
}

export default function PasoResumen({ servicio, fecha, hora, cliente, guardando, errorGuardado, onConfirmar, onVolver, formatearPrecio }: Props) {
  const colorPrimario = 'var(--brand-primary)';
  return (
    <section>
      <BackButton text="Volver a Datos" onClick={onVolver} />
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-lg font-bold text-white">Resumen de tu reserva</h2>
        <p className="mt-1 text-xs text-slate-400">Confirma que todo esté correcto</p>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-white/5 p-3.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Servicio</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{servicio.nombre} <span className="text-slate-500 font-normal">({servicio.duracion_minutos} min)</span></span>
              <span className="text-sm font-bold" style={{ color: colorPrimario }}>{formatearPrecio(Number(servicio.valor))}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/5 p-3.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Fecha y Hora</p>
            <p className="text-sm font-semibold text-white">{fecha} a las {hora}</p>
          </div>
          <div className="rounded-xl border border-white/5 p-3.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Cliente</p>
            <p className="text-sm font-semibold text-white">{cliente.nombre}</p>
            <p className="text-xs text-slate-400">{cliente.telefono}</p>
          </div>
        </div>

        {errorGuardado && <p className="mt-3 text-center text-xs font-medium text-red-400">{errorGuardado}</p>}

        <button type="button" disabled={guardando} onClick={onConfirmar}
          className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: colorPrimario }}>
          {guardando ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Guardando...</>
          ) : (
            <><CheckCircle size={16} /> Confirmar Cita</>
          )}
        </button>
      </div>
    </section>
  );
}
