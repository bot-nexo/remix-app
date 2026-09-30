import { cancelarCita, Citas, obtenerActivas } from "@/src/services/misCitas";
import { AlertTriangle, Calendar, CalendarOff, ChevronDown, Clock, HandHeart, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from '../../contexts/ToastContext';
import { getBookingErrorMessage } from "../../services/bookingApi";
import BackButton from "../ui/BackButton";

interface Props {
    onVolver: () => void;
    idCliente: string;
    bookingToken: string;
}

export default function PasoCancelarCita({ onVolver, idCliente, bookingToken }: Props) {
    const { showToast } = useToast();
    const [citaAEliminar, setCitaAEliminar] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [citas, setCitas] = useState<Citas[]>([]);

    useEffect(() => {
        if (idCliente && bookingToken) cargarCitas();
    }, [idCliente, bookingToken]);

    const cargarCitas = async () => {
        try {
            setLoading(true);
            setError('');
            const citas = await obtenerActivas(bookingToken);
            if (citas) {
                setCitas(citas);
            } else {
                showToast("Error al cargar las citas", "error");
            }
        } catch (requestError) {
            console.error("Error al cargar las citas:", requestError);
            setError(getBookingErrorMessage(requestError, 'No pudimos cargar tus citas.'));
        } finally {
            setLoading(false);
        }
    };

    const confirmEliminar = async () => {
        if (!citaAEliminar) return;
        try {
            setLoading(true);
            const res = await cancelarCita(citaAEliminar.id, bookingToken);
            if (res) {
                showToast("Cita cancelada exitosamente", "success");
                await cargarCitas();
                setCitaAEliminar(null);
            } else {
                showToast("Error al cancelar la cita", "error");
            }
        } catch (requestError) {
            console.error("Error al cancelar la cita:", requestError);
            setError(getBookingErrorMessage(requestError, 'No pudimos cancelar la cita.'));
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (estado: string) => {
        const statusStyles: Record<string, string> = {
            AGENDADO: "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20",
            PENDIENTE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            CANCELADO: "bg-rose-500/10 text-rose-400 border-rose-500/20",
            CANCELADO_CLIENTE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
            COMPLETADA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
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
                    <p className="text-lg text-slate-400">Cargando tus citas...</p>
                </div>
            </section>
        );
    }

    //**************************** */
    return (
        <section className="max-w-md mx-auto space-y-4 px-2 pb-8 relative">
            <BackButton text="Volver al Menú Principal" onClick={onVolver} />

            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-100">Mis Citas</h2>
                    <p className="text-xs text-slate-400">Gestiona e historial de reservas</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60">
                    {citas.length} {citas.length === 1 ? "cita" : "citas"}
                </span>
            </div>
            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
                    <p className="text-sm text-rose-200">{error}</p>
                    <button type="button" onClick={cargarCitas} className="mt-3 text-xs font-semibold text-rose-300 underline">Intentar de nuevo</button>
                </div>
            )}
            {citas.length === 0 && !loading && (
                <div className="mt-10 text-center py-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                    <CalendarOff className="w-16 h-16 mx-auto mb-2 text-slate-400" />
                    <p className=" text-[var(--brand-primary)] text-lg  font-medium">Usted no tienes citas programadas.</p>
                </div>
            )}

            {/* Tarjetas Mobile */}
            <div className="space-y-3">
                {citas.map((cita: any) => (
                    <div
                        key={cita.id}
                        className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 shadow-md backdrop-blur-sm space-y-3 relative group"
                    >
                        {/* Cabecera Tarjeta: Nombre y Estado */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-700/40 pb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-700/50 text-[var(--brand-primary)]">
                                    <HandHeart className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-100 text-sm leading-tight">
                                        {/* {cita.cliente_nombre}-- */}
                                        <span>{cita.servicios?.nombre || 'Servicio'}</span>

                                    </h3>
                                    <div className="flex items-center gap-1 text-[11px] text-[var(--brand-primary)] mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-semibold text-slate-100 text-xs leading-tight">{cita.duracion_servicio} min</span>
                                    </div>
                                </div>
                            </div>
                            {getStatusBadge(cita.estado)}
                        </div>

                        {/* Detalles Cita */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                                <span>{cita.fecha_inicio}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                                <span>
                                    {cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}
                                </span>
                            </div>
                        </div>

                        {/* Botón de Cancelar/Eliminar Cita */}
                        {!["CANCELADO", "CANCELADO_CLIENTE", "CANCELADO_INASISTENCIA", "COMPLETADA"].includes(cita.estado) && (
                            <div className="pt-1 flex justify-end">
                                <button
                                    onClick={() => setCitaAEliminar(cita)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Cancelar cita</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Recarga manual */}
            {citas.length > 2 && (
                <div className="pt-2">
                    <button
                        onClick={cargarCitas}

                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                <span>Cargando...</span>
                            </>
                        ) : (
                            <>
                                <span>Actualizar citas</span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Modal de Confirmación de Cancelación */}
            {citaAEliminar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-2 bg-rose-500/10 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-slate-100 text-base">¿Cancelar cita?</h3>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            ¿Estás seguro de que deseas cancelar la cita? <br />
                            <strong>Servicio:</strong>
                            <strong className="text-slate-100"><span className="text-xs font-semibold text-red-400">{" "}{citaAEliminar.servicios?.nombre || 'Servicio'}</span></strong>
                            <br /><strong>Fecha:</strong>
                            <strong className="text-slate-100"><span className="text-xs font-semibold text-red-400">{" "}{citaAEliminar.fecha_inicio}</span></strong>
                            -- <strong>Hora:</strong>
                            <strong className="text-slate-100"><span className="text-xs font-semibold text-red-400">{" "}{citaAEliminar.hora_inicio?.slice(0, 5)}</span></strong>

                        </p>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setCitaAEliminar(null)}
                                disabled={loading}
                                className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={confirmEliminar}
                                disabled={loading}
                                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    "Sí, cancelar"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
