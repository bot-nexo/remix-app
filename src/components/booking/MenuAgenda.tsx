import { ArrowRight } from "lucide-react";
import { EmpresaConfig } from "../../services/empresaService";
import { OPCIONES_MENU } from "@/src/arreglos";

interface Props {
    onSeleccionarOpcion: (opcion: number) => void;
    empresa: EmpresaConfig | null;
}



//************************** */
export default function MenuAgenda({ onSeleccionarOpcion, empresa }: Props) {
    return (
        <section className="space-y-6">
            {/* Saludo de Agente */}
            <div className="rounded-2xl bg-slate-800/90 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🤖✨</span>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">¡Hola! Soy <span style={{ color: 'var(--brand-primary)', fontSize: '1.5rem' }}>{empresa?.nom_bot || "Mia"}</span></h2>
                        <p className="text-sm mt-2 text-[var(--brand-primary)] font-medium">Asistente virtual de {empresa?.nombre || "Mi Agenda"}</p>
                    </div>
                </div>
                <p className="mt-4 text-sm text-slate-300">
                    ¿En qué te puedo ayudar hoy? Selecciona una opción para continuar:
                </p>
            </div>

            {/* Lista de Opciones */}
            <div className="grid gap-3">
                {OPCIONES_MENU?.map((opt) => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSeleccionarOpcion(opt.id)}
                        className="flex items-center justify-between rounded-2xl p-4 text-left transition-all duration-200 bg-slate-800 active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-4">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 border border-slate-700/50 text-xl">
                                {opt.icono}
                            </span>
                            <div>
                                <h3 className="font-semibold text-slate-100">{opt.id}. {opt.titulo}</h3>
                                <p className="text-xs text-[var(--brand-primary)]">{opt.desc}</p>
                            </div>
                        </div>
                        <span className="text-[var(--brand-primary)]"><ArrowRight /></span>
                    </button>
                ))}
            </div>
        </section>
    );
}