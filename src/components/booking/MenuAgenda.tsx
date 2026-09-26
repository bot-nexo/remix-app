import { OPCIONES_MENU } from "@/src/arreglos";
import { ArrowRight, Calendar, CalendarOff, CalendarSync, MapPin, MessageCircle, Scissors, Search } from "lucide-react";
import { EmpresaConfig } from "../../services/empresaService";

interface Props {
    onSeleccionarOpcion: (opcion: number) => void;
    empresa: EmpresaConfig | null;
}

export default function MenuAgenda({ onSeleccionarOpcion, empresa }: Props) {
    const colorPrimario = empresa?.color_primario || '#1083b9';
    const iconos = [Scissors, Search, CalendarOff, CalendarSync, MessageCircle, MapPin];
    const opcionesSecundarias = OPCIONES_MENU.filter((opcion) => opcion.id !== 1);

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3 pb-1">
                <img src={empresa?.logo_url || '/logo.svg'} alt="" className="h-12 w-12 shrink-0 object-contain" />
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{empresa?.nombre || 'Angel Nails'}</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">Hola, soy <span style={{ color: colorPrimario }}>{empresa?.nom_bot || 'Mia'}</span></h2>
                </div>
            </div>

            {OPCIONES_MENU[0] && (
                <button
                    type="button"
                    onClick={() => onSeleccionarOpcion(OPCIONES_MENU[0].id)}
                    className="group flex min-h-24 w-full items-center gap-4 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    style={{ backgroundColor: colorPrimario, borderColor: `${colorPrimario}CC` }}
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/10 text-white">
                        <Calendar size={23} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-white">Agendar una cita</span>
                        <span className="mt-1 block text-xs text-white/80">Elige servicio, día y hora</span>
                    </span>
                    <ArrowRight size={19} className="shrink-0 text-white transition-transform group-hover:translate-x-1" />
                </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
                {opcionesSecundarias.map((opt, index) => {
                    const Icon = iconos[index];
                    return (
                    <button key={opt.id} type="button" onClick={() => onSeleccionarOpcion(opt.id)}
                        className="flex min-h-32 flex-col items-start rounded-xl border border-white/10 bg-white/[0.035] p-3.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: colorPrimario, background: `${colorPrimario}1A` }}>
                            <Icon size={18} strokeWidth={1.8} />
                        </span>
                        <span className="text-xs font-semibold leading-snug text-white">{opt.titulo}</span>
                        <span className="mt-1 text-[10px] leading-snug text-slate-400">{opt.desc}</span>
                    </button>
                    );
                })}
            </div>
        </section>
    );
}
