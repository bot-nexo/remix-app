import BackButton from "../ui/BackButton";

type DatosCliente = {
  nombre: string;
  telefono: string;
  id?: string;
};

interface Props {
  cliente: DatosCliente;
  onChangeInput: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onVolver: () => void;
}

export default function PasoDatosCliente({ cliente, onChangeInput, onSubmit, onVolver }: Props) {
  return (
    <section>
      <BackButton
        text="Volver a Hora"
        onClick={onVolver}
      />

      <form onSubmit={onSubmit} className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-100">Ingresa tus datos</h2>
        <p className="mt-1 text-sm text-slate-400">Para confirmar la reserva de tu cita</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-[var(--brand-primary)]">
              Nombre completo *
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Ej. Ana María Pérez"
              value={cliente.nombre}
              onChange={onChangeInput}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-slate-100 placeholder-slate-500 shadow-inner 
              focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-[var(--brand-primary)]">
              Teléfono / WhatsApp *
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              required
              placeholder="Ej. 3001234567"
              value={cliente.telefono}
              onChange={onChangeInput}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-slate-100 placeholder-slate-500 shadow-inner 
              focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!cliente.nombre.trim() || !cliente.telefono.trim()}
          className={`
            mt-6 w-full rounded-xl px-4 py-3 font-semibold  transition active:scale-[0.99]
            ${cliente.nombre.trim() && cliente.telefono.trim()
              ? 'bg-[var(--brand-primary)] hover:opacity-90 text-slate-100 cursor-pointer'
              : 'cursor-not-allowed bg-slate-700 text-slate-400'
            }
          `}
        >
          Revisar y confirmar
        </button>
      </form>
    </section>
  );
}