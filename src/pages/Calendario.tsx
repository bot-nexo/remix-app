import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, Clock, AlertCircle, X } from 'lucide-react';
import { DIAS_SEMANA } from '../arreglos';
import { useToast } from '../contexts/ToastContext';
import { parsearHorario } from '../functions';

export default function Calendario() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { primaryColor } = useTheme();

    const [bloqueosExistentes, setBloqueosExistentes] = useState<any[]>([]);
    const [horariosExistentes, setHorariosExistentes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [horarioEmpresa, setHorarioEmpresa] = useState<{ apertura: string; cierre: string }>({ apertura: '09:00', cierre: '19:00' });

    const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
    const [fechaActual, setFechaActual] = useState(new Date());
    const [motivo, setMotivo] = useState('');
    const [bloqueoCompleto, setBloqueoCompleto] = useState(true);
    const [horaInicio, setHoraInicio] = useState('08:00');
    const [horaFin, setHoraFin] = useState('18:00');

    const hoy = new Date();
    const hoyStr = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString().split('T')[0];
    const anoEnCurso = hoy.getFullYear();

    const esMesActualOAnterior = fechaActual.getFullYear() < anoEnCurso || (fechaActual.getFullYear() === anoEnCurso && fechaActual.getMonth() <= hoy.getMonth());
    const esUltimoMesDelAno = fechaActual.getFullYear() >= anoEnCurso && fechaActual.getMonth() === 11;

    useEffect(() => {
        if (!user) return;
        const fetchHorarioEmpresa = async () => {
            const { data } = await supabase.from('empresa').select('horario').eq('user_id', user.id).limit(1).maybeSingle();
            if (data?.horario) setHorarioEmpresa(parsearHorario(data.horario));
        };
        fetchHorarioEmpresa();
    }, [user]);

    useEffect(() => { if (user) cargarAgendaMes(); }, [user, fechaActual]);

    const cargarAgendaMes = async () => {
        if (!user?.id) return;
        setLoading(true);
        const ano = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();
        const primerDiaMes = new Date(ano, mes, 1).toISOString().split('T')[0];
        const ultimoDiaMes = new Date(ano, mes + 1, 0).toISOString().split('T')[0];
        try {
            const [resH, resB] = await Promise.all([
                supabase.from('horario_atencion').select('*').eq('user_id', user.id).gte('fecha', primerDiaMes).lte('fecha', ultimoDiaMes),
                supabase.from('bloqueos_agenda').select('*').eq('user_id', user.id).gte('fecha', primerDiaMes).lte('fecha', ultimoDiaMes)
            ]);
            if (resH.error) showToast(resH.error.message, 'error');
            if (resB.error) showToast(resB.error.message, 'error');
            setHorariosExistentes(resH.data || []);
            setBloqueosExistentes(resB.data || []);
        } catch (error) { showToast('Error al cargar la agenda', 'error'); }
        finally { setLoading(false); }
    };

    const mesHabilitado = useMemo(() => horariosExistentes.length > 0, [horariosExistentes]);

    const generarHorarioAtencionMes = async () => {
        if (!user?.id) return;
        if (fechaActual.getFullYear() > anoEnCurso) { showToast('Solo hasta diciembre del año en curso.', 'warning'); return; }
        setLoading(true);
        try {
            const ano = fechaActual.getFullYear();
            const mes = fechaActual.getMonth();
            const ultimoDia = new Date(ano, mes + 1, 0).getDate();
            const esMismoMes = hoy.getFullYear() === ano && hoy.getMonth() === mes;
            const diaInicio = esMismoMes ? hoy.getDate() : 1;
            const HORA_INICIO = `${horarioEmpresa.apertura}:00`;
            const HORA_FIN = `${horarioEmpresa.cierre}:00`;
            const nuevosHorarios = [];
            for (let dia = diaInicio; dia <= ultimoDia; dia++) {
                const fechaObj = new Date(ano, mes, dia);
                const mesStr = String(mes + 1).padStart(2, '0');
                const diaStr = String(dia).padStart(2, '0');
                nuevosHorarios.push({ user_id: user.id, fecha: `${ano}-${mesStr}-${diaStr}`, dia_semana: fechaObj.getDay(), hora_inicio: HORA_INICIO, hora_fin: HORA_FIN, activo: true });
            }
            const { error } = await supabase.from('horario_atencion').upsert(nuevosHorarios, { onConflict: 'user_id,fecha' });
            if (error) showToast(error.message, 'error');
            await cargarAgendaMes();
            showToast('Mes habilitado correctamente.', 'success');
        } catch (err: any) { showToast('Error al habilitar el mes.', 'error'); }
        finally { setLoading(false); }
    };

    const cambiarMes = (delta: number) => {
        const nuevaFecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + delta, 1);
        const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        if (nuevaFecha < primerDiaMesActual || nuevaFecha.getFullYear() > anoEnCurso) return;
        setFechaActual(nuevaFecha);
    };

    const semanasDelMes = useMemo(() => {
        const year = fechaActual.getFullYear();
        const month = fechaActual.getMonth();
        const primerDia = new Date(year, month, 1);
        const ultimoDia = new Date(year, month + 1, 0);
        const semanas: Array<{ numero: number; inicio: Date; fin: Date; dias: Array<{ fechaStr: string; date: Date; diaSemanaIndex: number }> }> = [];
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
                    diasSemana.push({ fechaStr: `${ano}-${mesStr}-${diaStr}`, date: new Date(diaActual), diaSemanaIndex });
                }
                diaActual.setDate(diaActual.getDate() + 1);
                if (diaActual.getDay() === 1 && i !== 0) break;
            }
            semanas.push({ numero: contadorSemana++, inicio: inicioSemana, fin: new Date(diasSemana[diasSemana.length - 1].date), dias: diasSemana });
        }
        return semanas;
    }, [fechaActual]);

    const guardarBloqueo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!diaSeleccionado || !user) return;
        setLoading(true);
        const payload = { user_id: user.id, fecha: diaSeleccionado, bloqueo_completo: bloqueoCompleto, hora_inicio: bloqueoCompleto ? null : horaInicio, hora_fin: bloqueoCompleto ? null : horaFin, motivo: motivo || 'Bloqueo de agenda' };
        const { error } = await supabase.from('bloqueos_agenda').insert([payload]);
        if (error) showToast(error.message, 'error');
        else { showToast('Día bloqueado.', 'success'); setDiaSeleccionado(null); setMotivo(''); cargarAgendaMes(); }
        setLoading(false);
    };

    const eliminarBloqueo = async (id: string) => {
        setLoading(true);
        const { error } = await supabase.from('bloqueos_agenda').delete().eq('id', id);
        if (error) showToast(error.message, 'error'); else showToast('Día desbloqueado.', 'success');
        cargarAgendaMes(); setLoading(false);
    };

    const formatearFecha = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const nombreMesAno = fechaActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Calendario</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gestiona tu agenda, horarios y bloqueos</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                        <CalendarIcon className="w-4 h-4" style={{ color: primaryColor }} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{nombreMesAno}</h2>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                    <button onClick={() => cambiarMes(-1)} disabled={esMesActualOAnterior} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={() => setFechaActual(new Date())} className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">Hoy</button>
                    <button onClick={() => cambiarMes(1)} disabled={esUltimoMesDelAno} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {!loading && !mesHabilitado && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Agenda no configurada</h3>
                            <p className="text-xs text-amber-600 dark:text-amber-400/70">Habilita el horario para recibir citas este mes.</p>
                        </div>
                    </div>
                    <button onClick={generarHorarioAtencionMes} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 shrink-0">
                        <Clock size={14} />
                        {loading ? 'Generando...' : `Habilitar (${horarioEmpresa.apertura} - ${horarioEmpresa.cierre})`}
                    </button>
                </div>
            )}

            <div className={`space-y-4 transition-opacity ${!mesHabilitado ? 'opacity-40 pointer-events-none' : ''}`}>
                {semanasDelMes.map((semana) => (
                    <div key={semana.numero} className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex justify-between items-center">
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Semana {semana.numero}</h3>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{formatearFecha(semana.inicio)} - {formatearFecha(semana.fin)}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800/40">
                            {semana.dias.map((d) => {
                                const bloqueo = bloqueosExistentes.find((b) => b.fecha === d.fechaStr);
                                const existeEnHorario = horariosExistentes.some((h) => h.fecha === d.fechaStr);
                                const esHoy = d.fechaStr === hoyStr;
                                const esPasado = d.fechaStr < hoyStr;
                                return (
                                    <div key={d.fechaStr} className={`p-3 min-h-[100px] flex flex-col justify-between transition-all ${esPasado ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${esHoy ? 'bg-brand-primary/5' : ''}`}>
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">{DIAS_SEMANA[d.diaSemanaIndex]?.slice(0, 2)}</span>
                                                <span className={`text-sm font-bold ${esHoy ? 'text-brand-primary' : 'text-slate-700 dark:text-slate-300'}`}>{d.date.getDate()}</span>
                                            </div>
                                            {bloqueo ? (
                                                <div className={`p-1.5 rounded-lg border ${esPasado ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/30' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'}`}>
                                                    <div className="flex items-center gap-1"><Lock size={10} className={esPasado ? 'text-slate-400' : 'text-rose-500'} /><span className={`text-[10px] font-semibold ${esPasado ? 'text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>{bloqueo.bloqueo_completo ? 'Bloqueado' : 'Parcial'}</span></div>
                                                    {!bloqueo.bloqueo_completo && <p className="text-[9px] text-slate-400 mt-0.5">{bloqueo.hora_inicio?.slice(0, 5)} - {bloqueo.hora_fin?.slice(0, 5)}</p>}
                                                </div>
                                            ) : existeEnHorario ? (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                    <span className={`text-[10px] font-medium ${esPasado ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{esPasado ? 'Finalizado' : 'Disponible'}</span>
                                                </div>
                                            ) : <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 font-medium">Sin horario</div>}
                                        </div>
                                        <div className="flex justify-end mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                                            {esPasado ? <span className="text-[10px] text-slate-300 dark:text-slate-600">-</span> : bloqueo ? (
                                                <button onClick={() => eliminarBloqueo(bloqueo.id)} className="text-[10px] font-medium text-rose-500 hover:text-rose-600 transition-colors">Desbloquear</button>
                                            ) : existeEnHorario ? (
                                                <button onClick={() => setDiaSeleccionado(d.fechaStr)} className="text-[10px] font-semibold transition-colors hover:underline" style={{ color: primaryColor }}>+ Bloquear</button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {diaSeleccionado && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}><Lock size={14} style={{ color: primaryColor }} /></div>
                                <div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bloquear dia</h3><p className="text-[11px] text-slate-400">{diaSeleccionado}</p></div>
                            </div>
                            <button onClick={() => setDiaSeleccionado(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={16} /></button>
                        </div>
                        <form onSubmit={guardarBloqueo} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Motivo</label>
                                <input type="text" placeholder="Ej: Cita medica, festivo..." value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all" />
                            </div>
                            <div className="flex items-center gap-2.5">
                                <input type="checkbox" id="modalCompleto" checked={bloqueoCompleto} onChange={(e) => setBloqueoCompleto(e.target.checked)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-primary focus:ring-brand-primary/40 cursor-pointer" />
                                <label htmlFor="modalCompleto" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Bloquear todo el dia</label>
                            </div>
                            {!bloqueoCompleto && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Desde</label><input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all" /></div>
                                    <div><label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Hasta</label><input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all" /></div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                                <button type="button" onClick={() => setDiaSeleccionado(null)} className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-5 py-2 text-xs font-semibold text-white rounded-xl transition-all shadow-md disabled:opacity-50" style={{ backgroundColor: primaryColor }}>{loading ? 'Guardando...' : 'Confirmar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
