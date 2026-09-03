import { ArrowRight } from "lucide-react";
import { EmpresaConfig } from "../../services/empresaService";
import { OPCIONES_MENU } from "@/src/arreglos";

interface Props {
    onSeleccionarOpcion: (opcion: number) => void;
    empresa: EmpresaConfig | null;
}

export default function MenuAgenda({ onSeleccionarOpcion, empresa }: Props) {
    const colorPrimario = empresa?.color_primario || '#1083b9';

    return (
        <section className="space-y-5">
            <div className="rounded-2xl border border-white/5 p-5 backdrop-blur-sm" style={{ background: `linear-gradient(135deg, ${colorPrimario}10, rgba(255,255,255,0.02))` }}>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${colorPrimario}20` }}>💅</div>
                    <div>
                        <h2 className="text-lg font-bold text-white">¡Hola! Soy <span style={{ color: colorPrimario }}>{empresa?.nom_bot || "Mia"}</span></h2>
                        <p className="text-xs text-slate-400 mt-0.5">Tu asistente de {empresa?.nombre || "Angel Nails"}</p>
                    </div>
                </div>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">¿En qué te puedo ayudar? Elige una opción:</p>
            </div>
            <div className="space-y-2">
                {OPCIONES_MENU?.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => onSeleccionarOpcion(opt.id)}
                        className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${colorPrimario}12` }}>{opt.icono}</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white">{opt.titulo}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                        </div>
                        <ArrowRight size={16} className="text-slate-600 shrink-0" />
                    </button>
                ))}
            </div>
        </section>
    );
}
