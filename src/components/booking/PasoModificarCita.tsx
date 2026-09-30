import { ArrowRight, Calendar, CalendarOff, CalendarSync, Clock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from '../../contexts/ToastContext';
import { getBookingErrorMessage } from "../../services/bookingApi";
import { obtenerActivas } from "../../services/misCitas";
import BackButton from "../ui/BackButton";

interface Props {
    onVolver: () => void;
    idCliente: string;
    bookingToken: string;
    onSeleccionarCita: (cita: any) => void;
}

export default function PasoModificarCita({ onVolver, idCliente, bookingToken, onSeleccionarCita }: Props) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [citas, setCitas] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (idCliente && bookingToken) cargarCitas();
    }, [idCliente, bookingToken]);

    const cargarCitas = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await obtenerActivas(bookingToken);
            if (data) {
                setCitas(data);
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

    return (
        <section className="max-w-md mx-auto space-y-4 px-2 pb-8 relative">
            <BackButton text="Volver al Menú Principal" onClick={onVolver} />

            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-100">Reagendar Cita</h2>
                    <p className="text-xs text-slate-400">Selecciona la cita que deseas cambiar</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60">
                    {citas.length} {citas.length === 1 ? "disponible" : "disponibles"}
                </span>
            </div>
            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
                    <p className="text-sm text-rose-200">{error}</p>
                    <button type="button" onClick={cargarCitas} className="mt-3 text-xs font-semibold text-rose-300 underline">Intentar de nuevo</button>
                </div>
            )}

            {citas.length === 0 && !loading && (
                <div className="mt-10 text-center py-8 bg-slate-800/60 rounded-xl border border-slate-700/60 px-4">
                    <CalendarOff className="w-12 h-12 mx-auto text-slate-500 mb-2" />
                    <p className="text-[var(--brand-primary)] text-base font-medium">
                        No tienes citas activas para reagendar.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {citas.map((cita: any) => (
                    <div
                        key={cita.id}
                        className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 shadow-md backdrop-blur-sm space-y-3 relative"
                    >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-700/40 pb-2.5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                                    <CalendarSync className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-100 text-sm leading-tight">
                                        {cita.servicios?.nombre || "Servicio Reservado"}
                                    </h3>
                                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                        <Clock className="w-3 h-3 text-[var(--brand-primary)]" />
                                        <span>{cita.duracion_servicio || cita.servicios?.duracion_minutos || 30} min</span>
                                    </div>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                {cita.estado}
                            </span>
                        </div>

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

                        <div className="pt-1 flex justify-end">
                            <button
                                onClick={() => onSeleccionarCita(cita)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--brand-primary)] hover:opacity-90 text-slate-950 font-bold text-xs transition-all active:scale-[0.98] shadow-sm"
                            >
                                <span>Reagendar esta cita</span>
                                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
