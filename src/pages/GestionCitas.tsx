import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, UserCheck, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

interface Toast {
    id: number;
    tipo: 'success' | 'error' | 'warning';
    mensaje: string;
}


interface Cita {
    id: string;
    cliente_nombre: string;
    cliente_numero: string;
    fecha_inicio: string;
    hora_inicio: string;
    hora_fin: string;
    estado: string;
    servicios: { nombre: string; valor?: number } | null;
}

type FiltroRango = 'hoy' | 'semana' | 'mes' | 'todas';

export default function GestionCitas() {
    const { user } = useAuth();
    const [citas, setCitas] = useState<Cita[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    // Filtro activo y paginación
    const [filtroRango, setFiltroRango] = useState<FiltroRango>('todas');
    const [paginaActual, setPaginaActual] = useState(1);
    const elementosPorPagina = 8;


    //************************************** */
    // Sistema de Notificaciones Toast
    const showToast = (mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, tipo, mensaje }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    };

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const fetchCitas = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data } = await supabase
                .from('citas')
                .select(`
          id,
          cliente_nombre,
          cliente_numero,
          fecha_inicio,
          hora_inicio,
          hora_fin,
          duracion_servicio,
          estado,
          servicios ( nombre, valor )
        `)
                .eq('user_id', user.id)
                .order('fecha_inicio', { ascending: true })
                .order('hora_inicio', { ascending: true });

            setCitas((data as any) || []);
        } catch (error) {
            console.error('Error al traer citas:', error);
            showToast('Error al traer citas', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCitas();
    }, [user]);

    const handleCambiarEstado = async (citaId: string, nuevoEstado: string) => {
        const citaObjetivo = citas.find((c) => c.id === citaId);
        const hoyLocal = new Date().toLocaleDateString('en-CA');

        if (citaObjetivo && citaObjetivo.fecha_inicio !== hoyLocal) {
            showToast('Solo puedes cambiar el estado de las citas programadas para el día de hoy.', 'error');
            return;
        }

        setUpdatingId(citaId);
        try {
            const { error } = await supabase
                .from('citas')
                .update({ estado: nuevoEstado })
                .eq('id', citaId);

            if (error) {
                showToast(error.message || 'Error al actualizar estado', 'error');
                return;
            }

            setCitas((prev) =>
                prev.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c))
            );
        } catch (error) {
            console.error('Error al actualizar estado:', error);
            showToast('Error al actualizar estado', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    const citasFiltradas = useMemo(() => {
        const hoyLocal = new Date().toLocaleDateString('en-CA');
        const now = new Date();

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekStartStr = weekStart.toLocaleDateString('en-CA');
        const weekEndStr = weekEnd.toLocaleDateString('en-CA');
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        return citas.filter((cita) => {
            if (filtroRango === 'hoy') return cita.fecha_inicio === hoyLocal;
            if (filtroRango === 'semana') return cita.fecha_inicio >= weekStartStr && cita.fecha_inicio <= weekEndStr;
            if (filtroRango === 'mes') return cita.fecha_inicio.startsWith(monthPrefix);
            return true;
        });
    }, [citas, filtroRango]);

    const totalPaginas = Math.ceil(citasFiltradas.length / elementosPorPagina);
    const indiceInicio = (paginaActual - 1) * elementosPorPagina;
    const citasPaginadas = citasFiltradas.slice(indiceInicio, indiceInicio + elementosPorPagina);

    //*********************************** */
    return (
        <div className="space-y-6">
            {/* Container de Toasts */}
            <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${t.tipo === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                            : t.tipo === 'error'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                            }`}
                    >
                        {t.tipo === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                        {t.tipo === 'error' && <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
                        {t.tipo === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}

                        <div className="flex-1 text-xs font-semibold leading-relaxed">
                            {t.mensaje}
                        </div>

                        <button
                            onClick={() => removeToast(t.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Citas</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Control de estados e inasistencias en tiempo real</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header y Filtros */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-brand-primary" /> Citas Programadas
                    </h3>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl text-xs font-semibold">
                        {(['hoy', 'semana', 'mes', 'todas'] as FiltroRango[]).map((rango) => (
                            <button
                                key={rango}
                                onClick={() => { setFiltroRango(rango); setPaginaActual(1); }}
                                className={`px-3 py-1.5 rounded-lg transition-all capitalize ${filtroRango === rango
                                    ? 'bg-white dark:bg-slate-700 text-brand-primary shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {rango === 'semana' ? 'Esta Semana' : rango === 'mes' ? 'Este Mes' : rango}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Listado */}
                <div className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Cargando citas...</div>
                    ) : citasFiltradas.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <Calendar className="w-12 h-12 text-slate-400 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No hay citas registradas en este filtro.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                            {citasPaginadas.map((cita) => {
                                const horaInicio = cita.hora_inicio?.slice(0, 5) ?? '';
                                const horaFin = cita.hora_fin?.slice(0, 5) ?? '';
                                const isUpdating = updatingId === cita.id;

                                return (
                                    <li key={cita.id} className="px-6 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                                            <div className="min-w-0 sm:col-span-3">
                                                <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{cita.cliente_nombre}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{cita.cliente_numero}</p>
                                            </div>

                                            <div className="min-w-0 sm:col-span-3">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Servicio</p>
                                                <p className="text-xs font-medium truncate text-slate-700 dark:text-slate-300">{cita.servicios?.nombre}</p>
                                            </div>

                                            <div className="sm:col-span-3">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Horario</p>
                                                <p className="font-mono text-xs text-slate-700 dark:text-slate-300">{cita.fecha_inicio} • {horaInicio} - {horaFin}</p>
                                            </div>

                                            <div className="sm:col-span-3 flex items-center justify-start sm:justify-end gap-2">
                                                {isUpdating ? (
                                                    <span className="text-xs text-slate-400 animate-pulse">Actualizando...</span>
                                                ) : cita.estado === 'AGENDADO' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleCambiarEstado(cita.id, 'EN_ESPERA')}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all dark:text-emerald-400"
                                                        >
                                                            <UserCheck className="w-3.5 h-3.5" /> Llegó
                                                        </button>
                                                        <button
                                                            onClick={() => handleCambiarEstado(cita.id, 'CANCELADO_INASISTENCIA')}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-all dark:text-rose-400"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : cita.estado === 'EN_ESPERA' ? (
                                                    <button
                                                        onClick={() => handleCambiarEstado(cita.id, 'COMPLETADA')}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 transition-all dark:text-blue-400"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Completar
                                                    </button>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cita.estado === 'COMPLETADA'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                        }`}>
                                                        {cita.estado === 'COMPLETADA' ? 'Completada' : 'Inasistencia'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* Paginador */}
                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            <p>Mostrando <span className="font-medium text-slate-700 dark:text-slate-200">{indiceInicio + 1}</span> a <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(indiceInicio + elementosPorPagina, citasFiltradas.length)}</span> de <span className="font-medium text-slate-700 dark:text-slate-200">{citasFiltradas.length}</span></p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                                    disabled={paginaActual === 1}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"
                                >
                                    Anterior
                                </button>
                                <span>{paginaActual} / {totalPaginas}</span>
                                <button
                                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                                    disabled={paginaActual === totalPaginas}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}