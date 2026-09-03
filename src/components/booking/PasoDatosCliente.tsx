import BackButton from "../ui/BackButton";
import { User, Phone } from "lucide-react";

type DatosCliente = { nombre: string; telefono: string; id?: string; };

interface Props {
  cliente: DatosCliente;
  onChangeInput: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onVolver: () => void;
}

export default function PasoDatosCliente({ cliente, onChangeInput, onSubmit, onVolver }: Props) {
  const colorPrimario = 'var(--brand-primary)';
  const isValid = cliente.nombre.trim() && cliente.telefono.trim();
  return (
    <section>
      <BackButton text="Volver a Hora" onClick={onVolver} />
      <form onSubmit={onSubmit} className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-lg font-bold text-white">Ingresa tus datos</h2>
        <p className="mt-1 text-xs text-slate-400">Para confirmar tu reserva</p>
        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="nombre" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nombre completo *</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input id="nombre" name="nombre" type="text" required placeholder="Ej. Ana María Pérez" value={cliente.nombre} onChange={onChangeInput}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10" />
            </div>
          </div>
          <div>
            <label htmlFor="telefono" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Teléfono / WhatsApp *</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input id="telefono" name="telefono" type="tel" required placeholder="Ej. 3001234567" value={cliente.telefono} onChange={onChangeInput}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10" />
            </div>
          </div>
        </div>
        <button type="submit" disabled={!isValid}
          className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: isValid ? colorPrimario : 'rgba(255,255,255,0.05)',
            color: isValid ? 'white' : 'rgb(100,116,139)',
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}>
          Revisar y confirmar
        </button>
      </form>
    </section>
  );
}
