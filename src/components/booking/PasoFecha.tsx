import BackButton from "../ui/BackButton";

interface Props {
  servicioNombre: string;
  duracionMinutos: number;
  fechaSeleccionada: string;
  hoyStr: string;
  onFechaChange: (fecha: string) => void;
  onContinuar: () => void;
  onVolver: () => void;
  textoVolver?: string;
}

export default function PasoFecha({ servicioNombre, duracionMinutos, fechaSeleccionada, hoyStr, onFechaChange, onContinuar, onVolver, textoVolver = 'Volver a Servicios' }: Props) {
  const colorPrimario = 'var(--brand-primary)';
  return (
    <section>
      <BackButton text={textoVolver} onClick={onVolver} />
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-lg font-bold text-white">Selecciona la fecha</h2>
        <p className="mt-1 text-xs text-slate-300">
          <span className="font-medium" style={{ color: colorPrimario }}>{servicioNombre}</span> · {duracionMinutos} min
        </p>
        <div className="mt-5">
          <label htmlFor="fecha" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Fecha de la cita</label>
          <input id="fecha" type="date" min={hoyStr} value={fechaSeleccionada} onChange={(e) => onFechaChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10 [color-scheme:dark]" />
        </div>
        <button type="button" disabled={!fechaSeleccionada} onClick={onContinuar}
          className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: fechaSeleccionada ? colorPrimario : 'rgba(255,255,255,0.05)',
            color: fechaSeleccionada ? 'white' : 'rgb(100,116,139)',
            cursor: fechaSeleccionada ? 'pointer' : 'not-allowed',
          }}>
          Ver horas disponibles
        </button>
      </div>
    </section>
  );
}
