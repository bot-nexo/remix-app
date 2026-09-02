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

export default function PasoFecha({
  servicioNombre,
  duracionMinutos,
  fechaSeleccionada,
  hoyStr,
  onFechaChange,
  onContinuar,
  onVolver,
  textoVolver = 'Volver a Servicios',
}: Props) {
  return (
    <section>
      <BackButton
        text={textoVolver}
        onClick={onVolver}
      />

      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-100">Selecciona la fecha</h2>
        <p className="mt-1 text-sm text-slate-400">
          Para: <span className="font-medium text-slate-200">{servicioNombre}</span> ({duracionMinutos} min)
        </p>

        <div className="mt-6">
          <label htmlFor="fecha" className="block text-sm font-medium text-[var(--brand-primary)]">
            Fecha de la cita
          </label>
          <input
            id="fecha"
            type="date"
            min={hoyStr}
            value={fechaSeleccionada}
            onChange={(e) => onFechaChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-slate-100 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
          />
        </div>

        <button
          type="button"
          disabled={!fechaSeleccionada}
          onClick={onContinuar}
          className={`
            mt-6 w-full rounded-xl px-4 py-3 font-semibold transition active:scale-[0.99] 
            ${fechaSeleccionada ? 'bg-[var(--brand-primary)] text-white cursor-pointer hover:opacity-80' : 'cursor-not-allowed bg-slate-700 text-slate-400'}
          `}
        >
          Ver horas disponibles
        </button>
      </div>
    </section>
  );
}