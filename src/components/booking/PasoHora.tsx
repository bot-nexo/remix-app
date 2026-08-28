import BackButton from "../ui/BackButton";

interface Props {
  fechaSeleccionada: string;
  horasDisponibles: string[];
  horaSeleccionada: string;
  cargandoHoras: boolean;
  onHoraSeleccionar: (hora: string) => void;
  onContinuar: () => void;
  onVolver: () => void;
}

export default function PasoHora({
  fechaSeleccionada,
  horasDisponibles,
  horaSeleccionada,
  cargandoHoras,
  onHoraSeleccionar,
  onContinuar,
  onVolver,
}: Props) {
  return (
    <section>
      <BackButton
        text="Volver a Fecha"
        onClick={onVolver}
      />

      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-100">Selecciona la hora</h2>
        <p className="mt-1 text-sm text-slate-400">
          Fecha: <span className="font-medium text-[var(--brand-primary)]">{fechaSeleccionada}</span>
        </p>

        {cargandoHoras && (
          <p className="mt-6 text-center text-[var(--brand-primary)]">Consultando disponibilidad...</p>
        )}

        {!cargandoHoras && horasDisponibles.length === 0 && (
          <p className="mt-6 text-center text-[var(--brand-primary)]">
            No hay horarios disponibles para la fecha seleccionada.
          </p>
        )}

        {!cargandoHoras && horasDisponibles.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {horasDisponibles.map((hora) => (
              <button
                key={hora}
                type="button"
                onClick={() => onHoraSeleccionar(hora)}
                className={`
                  rounded-xl p-3 text-center text-sm font-bold transition duration-150
                  ${horaSeleccionada === hora
                    ? 'bg-[var(--brand-primary)] text-slate-900'
                    : 'border border-slate-700/70 bg-slate-900/60 text-slate-100 hover:border-[var(--brand-primary)] hover:bg-slate-800/70'
                  }
                `}
              >
                {hora}
              </button>
            ))}
          </div>
        )}

        {horaSeleccionada && (
          <button
            type="button"
            onClick={onContinuar}
            className="mt-6 w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 font-semibold 
            text-slate-100 transition hover:opacity-90 active:scale-[0.99]"
          >
            Continuar a tus datos
          </button>
        )}
      </div>
    </section>
  );
}