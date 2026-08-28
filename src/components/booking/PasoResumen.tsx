import BackButton from "../ui/BackButton";

type Servicio = {
  nombre: string;
  valor: number;
  duracion_minutos: number;
};

type DatosCliente = {
  nombre: string;
  telefono: string;
  id?: string;
};

interface Props {
  servicio: Servicio;
  fecha: string;
  hora: string;
  cliente: DatosCliente;
  guardando: boolean;
  errorGuardado: string;
  onConfirmar: () => void;
  onVolver: () => void;
  formatearPrecio: (valor: number) => string;
}

export default function PasoResumen({
  servicio,
  fecha,
  hora,
  cliente,
  guardando,
  errorGuardado,
  onConfirmar,
  onVolver,
  formatearPrecio,
}: Props) {
  return (
    <section>
      <BackButton
        text="Volver a Datos del Cliente"
        onClick={onVolver}
      />

      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-100">Resumen de tu reserva</h2>
        <p className="mt-1 text-sm text-slate-400">Por favor confirma que la información sea correcta</p>

        <div className="mt-6 space-y-4 tracking-wide text-sm">
          <div className="pt-1 pb-4 border-b border-slate-500/50">
            <p className="text-xs text-[var(--brand-primary)] uppercase tracking-wide">Servicio</p>
            <div className="mt-1 flex justify-between font-semibold text-slate-100">
              <span>{servicio.nombre} ({servicio.duracion_minutos} min)</span>
              <span className="text-[var(--brand-primary)]">{formatearPrecio(Number(servicio.valor))}</span>
            </div>
          </div>

          <div className="pt-1 pb-4 border-b border-slate-500/50">
            <p className="text-xs text-[var(--brand-primary)] uppercase tracking-wide">Fecha y Hora</p>
            <p className="mt-1 font-semibold text-slate-100">{fecha} a las {hora}</p>
          </div>

          <div className="pt-1 pb-4 border-b border-slate-500/50">
            <p className="text-xs text-[var(--brand-primary)] uppercase tracking-wide">Cliente</p>
            <p className="mt-1 font-semibold text-slate-100">{cliente.nombre}</p>
            <p className="text-slate-300">{cliente.telefono}</p>
          </div>

        </div>

        {errorGuardado && (
          <p className="mt-4 text-center text-sm font-medium text-red-400">{errorGuardado}</p>
        )}

        <button
          type="button"
          disabled={guardando}
          onClick={onConfirmar}
          className="mt-6 w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 font-semibold text-slate-200 transition 
          hover:opacity-90 disabled:bg-slate-700 disabled:text-slate-500 active:scale-[0.99]"
        >
          {guardando ? 'Guardando tu reserva...' : 'Confirmar Cita'}
        </button>
      </div>
    </section>
  );
}