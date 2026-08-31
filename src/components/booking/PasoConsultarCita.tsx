import { useState, useEffect } from "react";
import BackButton from "../ui/BackButton";
import { obtenerMisCitas } from "../../services/misCitas";
import { Calendar, Clock, ChevronDown, RefreshCw, HandHeart, CalendarOff } from "lucide-react";
import { useToast } from "@/src/contexts/ToastContext";

interface Props {
    onVolver: () => void;
    idCliente: string;
}

const ITEMS_PER_PAGE = 4;

export default function PasoConsultarCita({ onVolver, idCliente }: Props) {
    const { showToast } = useToast();
    const [citas, setCitas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Control de paginación
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    useEffect(() => {
        if (!idCliente) return;
        cargarCitas();
    }, [idCliente]);

    async function cargarCitas() {
        try {
            setLoading(true);
            const data = await obtenerMisCitas(idCliente);
            if (data) {
                setCitas(data);
            } else {
                showToast("No se encontraron citas", "warning");
            }
        } catch (err) {
            console.error(err);
            showToast("Error al cargar citas", "error");
        } finally {
            setLoading(false);
        }
    }

    const handleCargarMas = () => {
        setLoadingMore(true);
        setTimeout(() => {
            setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
            setLoadingMore(false);
        }, 300); // Pequeña animación de carga para suavidad en UI
    };

    const getStatusBadge = (estado: string) => {
        const statusStyles: Record<string, string> = {
            AGENDADO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            PENDIENTE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            CANCELADO: "bg-rose-500/10 text-rose-400 border-rose-500/20",
            CANCELADO_INASISTENCIA: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
            COMPLETADA: "bg-green-500/10 text-green-400 border-green-500/20",
        };

        const currentStyle = statusStyles[estado?.toUpperCase()] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${currentStyle}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                {estado}
            </span>
        );
    };

    if (loading) {
        return (
            <section className="max-w-md mx-auto space-y-4 px-2">
                <BackButton text="Volver al Menú Principal" onClick={onVolver} />
                <div className="flex flex-col mt-8 items-center justify-center py-16 gap-3">
                    <RefreshCw className="w-10 h-10 text-[var(--brand-primary)] animate-spin" />
                    <p className="text-lg text-slate-400">Cargando tu historial de citas...</p>
                </div>
            </section>
        );
    }



    const citasVisibles = citas.slice(0, visibleCount);
    const tieneMasCitas = visibleCount < citas.length;

    //*********************************** */
    return (
        <section className="max-w-md mx-auto space-y-4 px-2 pb-8">
            <BackButton text="Volver al Menú Principal" onClick={onVolver} />

            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-100">Historial de Citas</h2>
                    <p className="text-xs text-slate-400">Historial de citas agendadas</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60">
                    {citas.length} {citas.length === 1 ? "cita" : "citas"}
                </span>
            </div>
            {citas.length === 0 && !loading && (
                <div className="mt-10 text-center py-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                    <CalendarOff className="w-16 h-16 mx-auto mb-2 text-slate-400" />
                    <p className=" text-[var(--brand-primary)] text-lg  font-medium">No has tenido citas.</p>
                </div>
            )}

            {/* Tarjetas Mobile */}
            <div className="space-y-3">
                {citasVisibles.map((cita: any) => (
                    <div
                        key={cita.id}
                        className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 shadow-md backdrop-blur-sm space-y-3"
                    >
                        {/* Cabecera Tarjeta: Servicio, duración y Estado */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-700/40 pb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300">
                                    <HandHeart className="w-5 h-5 text-[var(--brand-primary)]" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-100 text-sm leading-tight">
                                        {cita.servicios.nombre}
                                    </h3>
                                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                        <Clock className="w-3 h-3 text-[var(--brand-primary)]" />
                                        <span>{cita.duracion_servicio} min.</span>
                                    </div>
                                </div>
                            </div>
                            {getStatusBadge(cita.estado)}
                        </div>

                        {/* Detalles Cita */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                                <span>{cita.fecha_inicio}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                                <span>{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Botón Cargar Más */}
            {tieneMasCitas && (
                <div className="pt-2">
                    <button
                        onClick={handleCargarMas}
                        disabled={loadingMore}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50"
                    >
                        {loadingMore ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                <span>Cargando...</span>
                            </>
                        ) : (
                            <>
                                <span>Cargar más citas</span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </>
                        )}
                    </button>
                </div>
            )}
        </section>
    );
}