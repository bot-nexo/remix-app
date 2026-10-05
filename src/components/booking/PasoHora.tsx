import BackButton from "../ui/BackButton";
import { Clock } from "lucide-react";

interface Props {
  fechaSeleccionada: string;
  horasDisponibles: string[];
  horaSeleccionada: string;
  servicioNombre: string;
  cargandoHoras: boolean;
  onHoraSeleccionar: (hora: string) => void;
  onContinuar: () => void;
  onVolver: () => void;
}

export default function PasoHora({ fechaSeleccionada, horasDisponibles, horaSeleccionada, servicioNombre, cargandoHoras, onHoraSeleccionar, onContinuar, onVolver }: Props) {
  const colorPrimario = 'var(--brand-primary)';
  return (
    <section>
      <BackButton text="Volver a Fecha" onClick={onVolver} />
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-lg font-bold text-white">Selecciona la hora</h2>
        <p className="mt-1 text-xs text-slate-300">
          <span className="font-medium" style={{ color: colorPrimario }}>{servicioNombre}</span> · {fechaSeleccionada}
        </p>

        {cargandoHoras && (
          <div className="mt-8 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: `${colorPrimario}40`, borderTopColor: 'transparent' }}></div>
            <p className="text-sm text-slate-300">Consultando disponibilidad...</p>
          </div>
        )}

        {!cargandoHoras && horasDisponibles.length === 0 && (
          <div className="mt-8 text-center py-6">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">No hay horarios disponibles para esta fecha.</p>
            <p className="text-[11px] text-slate-400 mt-1">Intenta con otra fecha.</p>
          </div>
        )}

        {!cargandoHoras && horasDisponibles.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {horasDisponibles.map((hora) => (
              <button key={hora} type="button" onClick={() => onHoraSeleccionar(hora)}
                className="rounded-xl p-3 text-center text-sm font-bold transition-all duration-150 active:scale-95"
                style={{
                  background: horaSeleccionada === hora ? colorPrimario : 'rgba(255,255,255,0.03)',
                  color: horaSeleccionada === hora ? 'white' : 'rgb(203,213,225)',
                  border: `1px solid ${horaSeleccionada === hora ? colorPrimario : 'rgba(255,255,255,0.06)'}`,
                }}>
                {hora}
              </button>
            ))}
          </div>
        )}

        {horaSeleccionada && (
          <button type="button" onClick={onContinuar}
            className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:brightness-110"
            style={{ background: colorPrimario }}>
            Continuar a tus datos
          </button>
        )}
      </div>
    </section>
  );
}
