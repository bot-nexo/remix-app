import { OPCIONES_MENU } from "@/src/arreglos";
import { findAngelPalette } from "@/src/constants/angelPalettes";
import { ArrowRight, Calendar, CalendarOff, CalendarSync, MapPin, MessageCircle, Scissors, Search, Sparkles } from "lucide-react";
import { EmpresaConfig } from "../../services/empresaService";

interface Props {
    onSeleccionarOpcion: (opcion: number) => void;
    empresa: EmpresaConfig | null;
}

export default function MenuAgenda({ onSeleccionarOpcion, empresa }: Props) {
    const colorPrimario = findAngelPalette(empresa?.color_primario, empresa?.color_secundario).primary;
    const iconos = [Scissors, Search, CalendarOff, CalendarSync, MessageCircle, MapPin];
    const opcionesSecundarias = OPCIONES_MENU.filter((opcion) => opcion.id !== 1);

    return (
        <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] px-5 py-5 shadow-2xl shadow-black/20">
                <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-white/10" />
                <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full border border-white/10" />
                <div className="relative flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <img src={empresa?.logo_url || '/logo.svg'} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-black/20 object-contain p-1" />
                        <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{empresa?.nombre || 'Angel Nails'}</p>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Tu momento empieza aquí.</h2>
                        </div>
                    </div>
                    <Sparkles size={18} className="mt-1 shrink-0" style={{ color: colorPrimario }} />
                </div>
                <p className="relative mt-4 max-w-[18rem] text-xs leading-relaxed text-slate-400">Hola, soy <span className="font-semibold text-white">{empresa?.nom_bot || 'Mia'}</span>. Te acompaño a encontrar el servicio y el horario ideal para ti.</p>
                <div className="relative mt-4 flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Atención personalizada</span>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span>Sin registro</span>
                </div>
            </div>

            {OPCIONES_MENU[0] && (
                <button
                    type="button"
                    onClick={() => onSeleccionarOpcion(OPCIONES_MENU[0].id)}
                    className="group flex min-h-24 w-full items-center gap-4 rounded-2xl border p-5 text-left shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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

            <div>
                <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">También puedes</p>
                    <span className="text-[10px] text-slate-600">Explora a tu ritmo</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                {opcionesSecundarias.map((opt, index) => {
                    const Icon = iconos[index];
                    return (
                    <button key={opt.id} type="button" onClick={() => onSeleccionarOpcion(opt.id)}
                        className="flex min-h-32 flex-col items-start rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: colorPrimario, background: `${colorPrimario}1A` }}>
                            <Icon size={18} strokeWidth={1.8} />
                        </span>
                        <span className="text-xs font-semibold leading-snug text-white">{opt.titulo}</span>
                        <span className="mt-1 text-[10px] leading-snug text-slate-400">{opt.desc}</span>
                    </button>
                    );
                })}
                </div>
            </div>
        </section>
    );
}
