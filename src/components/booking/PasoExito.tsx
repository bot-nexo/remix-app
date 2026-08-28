type Servicio = {
  nombre: string;
};

type DatosCliente = {
  nombre: string;
  telefono: string;
};

interface Props {
  servicio: Servicio;
  fecha: string;
  hora: string;
  cliente: DatosCliente;
  onNuevaReserva: () => void;
}

export default function PasoExito({ servicio, fecha, hora, cliente, onNuevaReserva }: Props) {
  return (
    <section className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-8 text-center shadow-xl backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]/50 border-2 border-[var(--brand-primary)]/80 text-white text-2xl">
        ✓
      </div>
      <h2 className="mt-4 text-2xl font-bold text-slate-100">¡Cita Reservada con Éxito!</h2>
      <p className="mt-2 text-slate-300">
        Te esperamos el <span className="font-semibold text-[var(--brand-primary)]">{fecha}</span> a las <span className="font-semibold text-[var(--brand-primary)]">{hora}</span>.
      </p>

      <div className="mt-6 rounded-xl bg-slate-900/70 border border-[var(--brand-primary)]/50 p-4 text-left text-md space-y-1">
        <p><strong className="text-slate-100">Servicio:</strong> <span className="text-[var(--brand-primary)] text-lg font-medium">{servicio.nombre}</span></p>
        <p><strong className="text-slate-100">Cliente:</strong> <span className="text-[var(--brand-primary)] text-lg font-medium">{cliente.nombre}</span></p>
        <p><strong className="text-slate-100">Teléfono:</strong> <span className="text-[var(--brand-primary)] text-lg font-medium">{cliente.telefono}</span></p>
      </div>

      <button
        type="button"
        onClick={onNuevaReserva}
        className="mt-8 w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 font-semibold text-slate-100 transition hover:opacity-90 active:scale-[0.99]"
      >
        Terminar
      </button>
    </section>
  );
}