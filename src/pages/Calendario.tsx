import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, Unlock, Clock, AlertCircle } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Calendario() {
    const { user } = useAuth();
    const { companyData } = useTheme();

    const primaryColor = companyData?.color_primario || '#8b5cf6';
    const secondaryColor = companyData?.color_secundario || '#64748b';

    const [bloqueosExistentes, setBloqueosExistentes] = useState<any[]>([]);
    const [horariosExistentes, setHorariosExistentes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Estado del modal de bloqueo
    const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
    const [fechaActual, setFechaActual] = useState(new Date());
    const [motivo, setMotivo] = useState('');
    const [bloqueoCompleto, setBloqueoCompleto] = useState(true);
    const [horaInicio, setHoraInicio] = useState('08:00');
    const [horaFin, setHoraFin] = useState('18:00');

    const hoy = new Date();
    const hoyStr = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString().split('T')[0];
    const anoEnCurso = hoy.getFullYear();

    // Límites de navegación
    const esMesActualOAnterior = fechaActual.getFullYear() < anoEnCurso ||
        (fechaActual.getFullYear() === anoEnCurso && fechaActual.getMonth() <= hoy.getMonth());

    // Candado para no avanzar más allá de Diciembre del año en curso
    const esUltimoMesDelAno = fechaActual.getFullYear() >= anoEnCurso && fechaActual.getMonth() === 11;

    // Cargar horarios del mes activo
    useEffect(() => {
        if (user) {
            cargarAgendaMes();
        }
    }, [user, fechaActual]);

    const cargarAgendaMes = async () => {
        if (!user?.id) return;
        setLoading(true);

        const ano = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();

        const primerDiaMes = new Date(ano, mes, 1).toISOString().split('T')[0];
        const ultimoDiaMes = new Date(ano, mes + 1, 0).toISOString().split('T')[0];

        try {
            const [resHorarios, resBloqueos] = await Promise.all([
                supabase
                    .from('horario_atencion')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('fecha', primerDiaMes)
                    .lte('fecha', ultimoDiaMes),
                supabase
                    .from('bloqueos_agenda')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('fecha', primerDiaMes)
                    .lte('fecha', ultimoDiaMes)
            ]);

            if (resHorarios.error) throw resHorarios.error;
            if (resBloqueos.error) throw resBloqueos.error;

            setHorariosExistentes(resHorarios.data || []);
            setBloqueosExistentes(resBloqueos.data || []);
        } catch (error) {
            console.error('Error al cargar la agenda:', error);
        } finally {
            setLoading(false);
        }
    };

    // Validar si el mes visible ya tiene registros creados en horario_atencion
    const mesHabilitado = useMemo(() => {
        return horariosExistentes.length > 0;
    }, [horariosExistentes]);

    // Habilitar todo el mes actual en la BD
    const generarHorarioAtencionMes = async () => {
        if (!user?.id) return;

        // Protección extra: Evitar habilitar años futuros
        if (fechaActual.getFullYear() > anoEnCurso) {
            alert('Solo se permite configurar horarios hasta diciembre del año en curso.');
            return;
        }

        setLoading(true);

        try {
            const ano = fechaActual.getFullYear();
            const mes = fechaActual.getMonth();
            const ultimoDia = new Date(ano, mes + 1, 0).getDate();

            // Si es el mes actual, partimos de hoy; si es un mes futuro del mismo año, partimos del día 1
            const esMismoMes = hoy.getFullYear() === ano && hoy.getMonth() === mes;
            const diaInicio = esMismoMes ? hoy.getDate() : 1;

            const HORA_INICIO = '09:00:00';
            const HORA_FIN = '19:00:00';
            const nuevosHorarios = [];

            for (let dia = diaInicio; dia <= ultimoDia; dia++) {
                const fechaObj = new Date(ano, mes, dia);
                const mesStr = String(mes + 1).padStart(2, '0');
                const diaStr = String(dia).padStart(2, '0');
                const fechaStr = `${ano}-${mesStr}-${diaStr}`;
                const diaSemana = fechaObj.getDay();

                nuevosHorarios.push({
                    user_id: user.id,
                    fecha: fechaStr,
                    dia_semana: diaSemana,
                    hora_inicio: HORA_INICIO,
                    hora_fin: HORA_FIN,
                    activo: true,
                });
            }

            const { error } = await supabase
                .from('horario_atencion')
                .upsert(nuevosHorarios, { onConflict: 'user_id,fecha' });

            if (error) throw error;

            await cargarAgendaMes();
        } catch (err: any) {
            console.error('Error insertando horarios:', err);
            alert('Error al habilitar el mes.');
        } finally {
            setLoading(false);
        }
    };

    const cambiarMes = (delta: number) => {
        const nuevaFecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + delta, 1);
        const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        // Bloqueo de navegación pasada o más allá de Diciembre del año en curso
        if (nuevaFecha < primerDiaMesActual || nuevaFecha.getFullYear() > anoEnCurso) return;

        setFechaActual(nuevaFecha);
    };

    const semanasDelMes = useMemo(() => {
        const year = fechaActual.getFullYear();
        const month = fechaActual.getMonth();
        const primerDia = new Date(year, month, 1);
        const ultimoDia = new Date(year, month + 1, 0);

        const semanas: Array<{
            numero: number;
            inicio: Date;
            fin: Date;
            dias: Array<{ fechaStr: string; date: Date; diaSemanaIndex: number }>;
        }> = [];

        let diaActual = new Date(primerDia);
        let contadorSemana = 1;

        while (diaActual <= ultimoDia) {
            const diasSemana = [];
            const inicioSemana = new Date(diaActual);

            for (let i = 0; i < 7; i++) {
                if (diaActual.getMonth() === month) {
                    const jsDay = diaActual.getDay();
                    const diaSemanaIndex = jsDay === 0 ? 6 : jsDay - 1;

                    const ano = diaActual.getFullYear();
                    const mesStr = String(diaActual.getMonth() + 1).padStart(2, '0');
                    const diaStr = String(diaActual.getDate()).padStart(2, '0');

                    diasSemana.push({
                        fechaStr: `${ano}-${mesStr}-${diaStr}`,
                        date: new Date(diaActual),
                        diaSemanaIndex
                    });
                }
                diaActual.setDate(diaActual.getDate() + 1);
                if (diaActual.getDay() === 1 && i !== 0) break;
            }

            const finSemana = new Date(diasSemana[diasSemana.length - 1].date);

            semanas.push({
                numero: contadorSemana++,
                inicio: inicioSemana,
                fin: finSemana,
                dias: diasSemana
            });
        }

        return semanas;
    }, [fechaActual]);

    const guardarBloqueo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!diaSeleccionado || !user) return;

        setLoading(true);
        const payload = {
            user_id: user.id,
            fecha: diaSeleccionado,
            bloqueo_completo: bloqueoCompleto,
            hora_inicio: bloqueoCompleto ? null : horaInicio,
            hora_fin: bloqueoCompleto ? null : horaFin,
            motivo: motivo || 'Imprevisto / Bloqueo de agenda'
        };

        const { error } = await supabase.from('bloqueos_agenda').insert([payload]);

        if (error) {
            alert('Error al bloquear día: ' + error.message);
        } else {
            setDiaSeleccionado(null);
            setMotivo('');
            cargarAgendaMes();
        }
        setLoading(false);
    };

    const eliminarBloqueo = async (id: string) => {
        setLoading(true);
        await supabase.from('bloqueos_agenda').delete().eq('id', id);
        cargarAgendaMes();
    };

    const formatearFecha = (date: Date) => {
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    };

    const nombreMesAno = fechaActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return (
        <>
            <div className="w-full max-w-5xl mx-auto space-y-6 text-slate-100">

                {/* CABECERA Y NAVEGACIÓN */}
                <div
                    className="p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 transition-all"
                    style={{ backgroundColor: primaryColor }}
                >
                    <div className="flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-white" />
                        <h1 className="text-2xl font-bold capitalize text-white">{nombreMesAno}</h1>
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl backdrop-blur-md">
                        <button
                            onClick={() => cambiarMes(-1)}
                            disabled={esMesActualOAnterior}
                            className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={esMesActualOAnterior ? 'No puedes ver meses pasados' : 'Mes anterior'}
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <button
                            onClick={() => setFechaActual(new Date())}
                            className="px-3 py-1 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg text-white"
                        >
                            Hoy
                        </button>

                        <button
                            onClick={() => cambiarMes(1)}
                            disabled={esUltimoMesDelAno}
                            className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={esUltimoMesDelAno ? 'Solo se permite habilitar agenda hasta diciembre' : 'Mes siguiente'}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* BANNER SI EL MES NO HA SIDO HABILITADO EN BD */}
                {!loading && !mesHabilitado && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />
                            <div>
                                <h3 className="text-base font-bold text-amber-200">
                                    Agenda no configurada para este mes
                                </h3>
                                <p className="text-xs text-amber-300/80">
                                    Para recibir citas y gestionar bloqueos en este mes, primero debes habilitar el horario general de atención.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={generarHorarioAtencionMes}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all border border-emerald-400/30 whitespace-nowrap disabled:opacity-50"
                        >
                            <Clock size={16} />
                            <span>{loading ? 'Generando en BD...' : 'Habilitar Mes (09:00 - 19:00)'}</span>
                        </button>
                    </div>
                )}

                {/* VISTA DEL MES DESGLOSADA POR SEMANAS */}
                <div className={`space-y-6 transition-opacity ${!mesHabilitado ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    {semanasDelMes.map((semana) => (
                        <div
                            key={semana.numero}
                            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                        >
                            <div
                                className="px-6 py-3 border-b border-slate-800 flex justify-between items-center"
                                style={{ borderLeft: `4px solid ${primaryColor}` }}
                            >
                                <h2 className="font-semibold text-slate-200">
                                    Semana {semana.numero}
                                </h2>
                                <span
                                    className="text-xs px-3 py-1 rounded-full font-medium"
                                    style={{ backgroundColor: `${secondaryColor}20`, color: secondaryColor }}
                                >
                                    Del {formatearFecha(semana.inicio)} al {formatearFecha(semana.fin)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-px bg-slate-800/50">
                                {semana.dias.map((d) => {
                                    const bloqueo = bloqueosExistentes.find((b) => b.fecha === d.fechaStr);
                                    const existeEnHorario = horariosExistentes.some((h) => h.fecha === d.fechaStr);
                                    const esHoy = d.fechaStr === hoyStr;
                                    const esPasado = d.fechaStr < hoyStr;

                                    return (
                                        <div
                                            key={d.fechaStr}
                                            className={`p-4 bg-slate-900 flex flex-col justify-between min-h-[120px] transition-all ${esPasado
                                                    ? 'bg-slate-950/60 opacity-50 cursor-not-allowed'
                                                    : 'hover:bg-slate-800/40'
                                                } ${esHoy ? 'ring-2 ring-inset' : ''}`}
                                            style={{ borderColor: esHoy ? primaryColor : 'transparent' }}
                                        >
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`text-xs font-medium ${esPasado ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        {DIAS_SEMANA[d.diaSemanaIndex]}
                                                    </span>
                                                    <span className={`text-sm font-bold ${esPasado ? 'text-slate-600' : esHoy ? 'text-white' : 'text-slate-300'}`}>
                                                        {d.date.getDate()}
                                                    </span>
                                                </div>

                                                {/* ESTADO DEL DÍA */}
                                                {bloqueo ? (
                                                    <div className={`p-2 rounded-lg space-y-1 border ${esPasado
                                                            ? 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                                                            : 'bg-red-500/10 border-red-500/20'
                                                        }`}>
                                                        <div className={`flex items-center gap-1 font-semibold text-xs ${esPasado ? 'text-slate-500' : 'text-red-400'}`}>
                                                            <Lock size={12} />
                                                            <span>{bloqueo.bloqueo_completo ? 'Día Bloqueado' : 'Hora Bloqueada'}</span>
                                                        </div>
                                                        {!bloqueo.bloqueo_completo && (
                                                            <p className="text-[10px] text-slate-500">
                                                                {bloqueo.hora_inicio?.slice(0, 5)} - {bloqueo.hora_fin?.slice(0, 5)}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : existeEnHorario ? (
                                                    <div className={`flex items-center gap-1 text-xs mt-1 ${esPasado ? 'text-slate-600' : 'text-emerald-400'}`}>
                                                        <Unlock size={12} />
                                                        <span>{esPasado ? 'Pasado' : 'Disponible'}</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-600 mt-1 font-medium">
                                                        Sin horario
                                                    </div>
                                                )}
                                            </div>

                                            {/* BOTÓN DE ACCIÓN */}
                                            <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-end">
                                                {esPasado ? (
                                                    <span className="text-[11px] text-slate-600 font-medium select-none">
                                                        Finalizado
                                                    </span>
                                                ) : bloqueo ? (
                                                    <button
                                                        onClick={() => eliminarBloqueo(bloqueo.id)}
                                                        className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                                                    >
                                                        Desbloquear
                                                    </button>
                                                ) : existeEnHorario ? (
                                                    <button
                                                        onClick={() => setDiaSeleccionado(d.fechaStr)}
                                                        className="text-[11px] font-medium transition-colors hover:underline"
                                                        style={{ color: primaryColor }}
                                                    >
                                                        + Bloquear
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAL DE BLOQUEO */}
            {diaSeleccionado && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-11/12 sm:w-full max-w-md shadow-2xl space-y-4 my-auto">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Lock size={18} style={{ color: primaryColor }} />
                            Bloquear Día ({diaSeleccionado})
                        </h3>

                        <form onSubmit={guardarBloqueo} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Motivo del bloqueo</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Cita médica, Festivo, Personal..."
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="modalCompleto"
                                    checked={bloqueoCompleto}
                                    onChange={(e) => setBloqueoCompleto(e.target.checked)}
                                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                                />
                                <label htmlFor="modalCompleto" className="text-sm text-slate-300 cursor-pointer">
                                    Bloquear todo el día
                                </label>
                            </div>

                            {!bloqueoCompleto && (
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Hora Inicio</label>
                                        <input
                                            type="time"
                                            value={horaInicio}
                                            onChange={(e) => setHoraInicio(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Hora Fin</label>
                                        <input
                                            type="time"
                                            value={horaFin}
                                            onChange={(e) => setHoraFin(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setDiaSeleccionado(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-5 py-2 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-50"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {loading ? 'Guardando...' : 'Confirmar Bloqueo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}