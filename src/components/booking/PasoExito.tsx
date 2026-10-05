import { CheckCircle, Calendar, Clock, User } from "lucide-react";

type Servicio = { nombre: string; };
type DatosCliente = { nombre: string; telefono: string; };

interface Props {
  servicio: Servicio; fecha: string; hora: string; cliente: DatosCliente;
  onNuevaReserva: () => void;
}

export default function PasoExito({ servicio, fecha, hora, cliente, onNuevaReserva }: Props) {
  const colorPrimario = 'var(--brand-primary)';
  return (
    <section className="rounded-2xl border border-white/5 p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${colorPrimario}20` }}>
        <CheckCircle className="w-8 h-8" style={{ color: colorPrimario }} />
      </div>
      <h2 className="text-xl font-bold text-white">¡Cita Reservada!</h2>
      <p className="mt-2 text-sm text-slate-200">Te esperamos el <span className="font-semibold" style={{ color: colorPrimario }}>{fecha}</span> a las <span className="font-semibold" style={{ color: colorPrimario }}>{hora}</span></p>

      <div className="mt-5 rounded-xl border border-white/5 p-4 text-left space-y-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${colorPrimario}15` }}><Calendar size={13} style={{ color: colorPrimario }} /></div>
          <span className="text-xs text-slate-300">{fecha} · {hora}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${colorPrimario}15` }}><User size={13} style={{ color: colorPrimario }} /></div>
          <span className="text-xs text-slate-300">{cliente.nombre} · {cliente.telefono}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${colorPrimario}15` }}><Clock size={13} style={{ color: colorPrimario }} /></div>
          <span className="text-xs font-medium" style={{ color: colorPrimario }}>{servicio.nombre}</span>
        </div>
      </div>

      <button type="button" onClick={onNuevaReserva}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:brightness-110"
        style={{ background: colorPrimario }}>
        Volver al Inicio
      </button>
    </section>
  );
}
