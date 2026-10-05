import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, UserCheck, CheckCircle2, XCircle, AlertCircle, X, Plus, Send, Phone, User, Sparkles, Search, Check } from 'lucide-react';
import { Cita, FiltroRango, Servicio, Cliente } from '../types/types';
import { useToast } from '../contexts/ToastContext';
import { obtenerServiciosActivos } from '../services/serviciosService';
import { crearCliente } from '../services/clientesService';
import { enviarNotificacionPlantilla } from '../services/notificacionesService';

export default function GestionCitas() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [citas, setCitas] = useState<Cita[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Filtro activo y paginación
    const [filtroRango, setFiltroRango] = useState<FiltroRango>('todas');
    const [paginaActual, setPaginaActual] = useState(1);
    const elementosPorPagina = 8;

    // Modal Agendar Cita Manual (Profesional)
    const [modalAgendarOpen, setModalAgendarOpen] = useState(false);
    const [nombreClienteForm, setNombreClienteForm] = useState('');
    const [telefonoClienteForm, setTelefonoClienteForm] = useState('');
    const [servicioIdForm, setServicioIdForm] = useState('');
    const [fechaForm, setFechaForm] = useState('');
    const [horaForm, setHoraForm] = useState('');
    const [guardandoCita, setGuardandoCita] = useState(false);

    // Búsqueda inteligente de clientas existentes
    const [sugerenciasClientes, setSugerenciasClientes] = useState<Cliente[]>([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
    const [buscandoCliente, setBuscandoCliente] = useState(false);
    const sugerenciasRef = useRef<HTMLDivElement>(null);

    // Horarios disponibles para la fecha seleccionada
    const [horariosDisponiblesModal, setHorariosDisponiblesModal] = useState<string[]>([]);
    const [cargandoHorariosModal, setCargandoHorariosModal] = useState(false);

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
        cargarServicios();
    }, [user]);

    const cargarServicios = async () => {
        try {
            const list = await obtenerServiciosActivos();
            setServicios(list);
            if (list.length > 0) {
                setServicioIdForm(list[0].id);
            }
        } catch (err) {
            console.error('Error al cargar servicios:', err);
        }
    };

    // Búsqueda en vivo de clientas al escribir en nombre o teléfono
    const buscarClientasCoincidentes = async (query: string) => {
        if (!query || query.trim().length < 2) {
            setSugerenciasClientes([]);
            setMostrarSugerencias(false);
            return;
        }

        setBuscandoCliente(true);
        try {
            const term = `%${query.trim()}%`;
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .or(`nombre.ilike.${term},numero.ilike.${term}`)
                .limit(5);

            if (!error && data) {
                setSugerenciasClientes(data as Cliente[]);
                setMostrarSugerencias(data.length > 0);
            }
        } catch (err) {
            console.error('Error buscando clientes:', err);
        } finally {
            setBuscandoCliente(false);
        }
    };

    const handleSeleccionarSugerencia = (c: Cliente) => {
        setNombreClienteForm(c.nombre);
        setTelefonoClienteForm(c.numero || '');
        setMostrarSugerencias(false);
        showToast(`Clienta "${c.nombre}" seleccionada.`, 'success');
    };

    // Calcular horarios disponibles cuando cambia fecha o servicio en el modal
    useEffect(() => {
        if (!fechaForm || !servicioIdForm || !user) {
            setHorariosDisponiblesModal([]);
            return;
        }

        calcularHorariosDisponiblesModal(fechaForm, servicioIdForm);
    }, [fechaForm, servicioIdForm, user]);

    const calcularHorariosDisponiblesModal = async (fechaStr: string, servicioId: string) => {
        setCargandoHorariosModal(true);
        setHoraForm('');
        try {
            const hoyLocal = new Date().toLocaleDateString('en-CA');
            if (fechaStr < hoyLocal) {
                setHorariosDisponiblesModal([]);
                setCargandoHorariosModal(false);
                return;
            }
            // 1. Obtener horario de atención de la empresa para esa fecha (o default 08:00 a 18:00)
            const { data: horarioData } = await supabase
                .from('horario_atencion')
                .select('hora_inicio, hora_fin, activo')
                .eq('user_id', user!.id)
                .eq('fecha', fechaStr)
                .maybeSingle();

            let horaInicio = '08:00';
            let horaFin = '18:00';

            if (horarioData) {
                if (horarioData.activo === false) {
                    setHorariosDisponiblesModal([]);
                    setCargandoHorariosModal(false);
                    return;
                }
                horaInicio = horarioData.hora_inicio?.slice(0, 5) || '08:00';
                horaFin = horarioData.hora_fin?.slice(0, 5) || '18:00';
            }

            // 2. Obtener citas agendadas para ese día
            const { data: citasExistentes } = await supabase
                .from('citas')
                .select('hora_inicio, hora_fin, estado')
                .eq('user_id', user!.id)
                .eq('fecha_inicio', fechaStr)
                .neq('estado', 'CANCELADO_INASISTENCIA');

            // 3. Obtener bloqueos de agenda para ese día
            const { data: bloqueos } = await supabase
                .from('bloqueos_agenda')
                .select('hora_inicio, hora_fin, bloqueo_completo')
                .eq('user_id', user!.id)
                .eq('fecha', fechaStr);

            if (bloqueos && bloqueos.some((b) => b.bloqueo_completo)) {
                setHorariosDisponiblesModal([]);
                setCargandoHorariosModal(false);
                return;
            }

            // 4. Generar slots de 30 o 45 minutos entre horaInicio y horaFin
            const duracion = servicios.find((s) => s.id === servicioId)?.duracion_minutos || 45;
            const slots: string[] = [];

            let [h, m] = horaInicio.split(':').map(Number);
            const [hFin, mFin] = horaFin.split(':').map(Number);
            const finTotalMin = hFin * 60 + mFin;

            while (h * 60 + m + duracion <= finTotalMin) {
                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                const slotHora = `${hh}:${mm}`;

                // Verificar colisión con citas agendadas
                const inicioMin = h * 60 + m;
                const finMin = inicioMin + duracion;

                const tieneColisionCita = (citasExistentes || []).some((c) => {
                    if (!c.hora_inicio || !c.hora_fin) return false;
                    const [cHi, cMi] = c.hora_inicio.slice(0, 5).split(':').map(Number);
                    const [cHf, cMf] = c.hora_fin.slice(0, 5).split(':').map(Number);
                    const cIni = cHi * 60 + cMi;
                    const cFin = cHf * 60 + cMf;
                    return inicioMin < cFin && finMin > cIni;
                });

                const tieneColisionBloqueo = (bloqueos || []).some((b) => {
                    if (!b.hora_inicio || !b.hora_fin) return false;
                    const [bHi, bMi] = b.hora_inicio.slice(0, 5).split(':').map(Number);
                    const [bHf, bMf] = b.hora_fin.slice(0, 5).split(':').map(Number);
                    const bIni = bHi * 60 + bMi;
                    const bFin = bHf * 60 + bMf;
                    return inicioMin < bFin && finMin > bIni;
                });

                if (!tieneColisionCita && !tieneColisionBloqueo) {
                    slots.push(slotHora);
                }

                // Avanzar según la duración del servicio (ej. 120 min = 2 horas)
                m += duracion;
                if (m >= 60) {
                    h += Math.floor(m / 60);
                    m = m % 60;
                }
            }

            setHorariosDisponiblesModal(slots);
            if (slots.length > 0) {
                setHoraForm(slots[0]);
            }
        } catch (err) {
            console.error('Error calculando disponibilidad:', err);
        } finally {
            setCargandoHorariosModal(false);
        }
    };

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

            if (nuevoEstado === 'CANCELADO_INASISTENCIA' && citaObjetivo?.cliente_numero) {
                enviarNotificacionPlantilla('cancelacion', {
                    nombre_cliente: citaObjetivo.cliente_nombre || 'Cliente',
                    telefono_cliente: citaObjetivo.cliente_numero,
                    servicio: citaObjetivo.servicios?.nombre || 'Servicio',
                    fecha_cita: citaObjetivo.fecha_inicio,
                    hora_cita: citaObjetivo.hora_inicio,
                });
            }

            setCitas((prev) =>
                prev.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c))
            );
            showToast('Estado de cita actualizado.', 'success');
        } catch (error) {
            console.error('Error al actualizar estado:', error);
            showToast('Error al actualizar estado', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    // Crear Cita Manualmente por la Profesional
    const handleCrearCitaManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!nombreClienteForm.trim() || !telefonoClienteForm.trim() || !servicioIdForm || !fechaForm || !horaForm) {
            showToast('Por favor completa todos los campos requeridos.', 'warning');
            return;
        }

        setGuardandoCita(true);
        try {
            const cleanPhone = telefonoClienteForm.replace(/\D/g, '');
            const fullPhone = (cleanPhone.length === 10 && cleanPhone.startsWith('3'))
                ? `57${cleanPhone}`
                : cleanPhone;

            // 1. Crear o actualizar cliente en BD para asegurar de tener numero y lid discriminados
            try {
                await crearCliente({ nombre: nombreClienteForm, numero: fullPhone });
            } catch (err) {
                // Si la clienta ya existe por número, continuar transparentemente
            }

            // 2. Calcular hora_fin en base a la duración del servicio
            const servicioSelec = servicios.find((s) => s.id === servicioIdForm);
            const duracion = servicioSelec?.duracion_minutos || 45;

            const [h, m] = horaForm.split(':').map(Number);
            const totalFinMin = h * 60 + m + duracion;
            const hFin = String(Math.floor(totalFinMin / 60)).padStart(2, '0');
            const mFin = String(totalFinMin % 60).padStart(2, '0');
            const horaFinStr = `${hFin}:${mFin}`;

            // 3. Insertar cita en Supabase
            const { error: insertErr } = await supabase.from('citas').insert([
                {
                    user_id: user.id,
                    cliente_nombre: nombreClienteForm.trim(),
                    cliente_numero: fullPhone,
                    servicio_id: servicioIdForm,
                    fecha_inicio: fechaForm,
                    hora_inicio: horaForm,
                    hora_fin: horaFinStr,
                    duracion_servicio: duracion,
                    estado: 'AGENDADO',
                },
            ]);

            if (insertErr) {
                throw new Error(insertErr.message || 'Error al agendar cita.');
            }

            showToast('¡Cita agendada exitosamente!', 'success');

            // 4. Enviar mensaje de WhatsApp de confirmación usando la plantilla
            enviarNotificacionPlantilla('confirmacion', {
                nombre_cliente: nombreClienteForm,
                telefono_cliente: fullPhone,
                servicio: servicioSelec?.nombre || 'Servicio',
                fecha_cita: fechaForm,
                hora_cita: horaForm,
            });

            setModalAgendarOpen(false);
            setNombreClienteForm('');
            setTelefonoClienteForm('');
            setFechaForm('');
            setHoraForm('');
            fetchCitas();
        } catch (err: any) {
            console.error('Error creando cita manual:', err);
            showToast(err.message || 'Error al agendar cita.', 'error');
        } finally {
            setGuardandoCita(false);
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

    const totalPaginas = Math.ceil(citasFiltradas.length / elementosPorPagina) || 1;
    const indiceInicio = (paginaActual - 1) * elementosPorPagina;
    const citasPaginadas = citasFiltradas.slice(indiceInicio, indiceInicio + elementosPorPagina);

    return (
        <div className="space-y-6">
            {/* Header Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Citas</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Control de estados e inasistencias en tiempo real</p>
                </div>

                <button
                    onClick={() => {
                        const hoyDefault = new Date().toISOString().slice(0, 10);
                        setFechaForm(hoyDefault);
                        setModalAgendarOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-brand-primary/20 transition-all hover:scale-[1.02]"
                >
                    <Plus size={18} />
                    <span>Agendar Cita</span>
                </button>
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
                    ) : citasPaginadas.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            No hay citas registradas para este filtro.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {citasPaginadas.map((cita) => {
                                const isUpdating = updatingId === cita.id;
                                return (
                                    <li key={cita.id} className="p-4 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                                            <div className="sm:col-span-4 space-y-1">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-base">{cita.cliente_nombre || 'Cliente sin nombre'}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                    <Phone size={13} className="text-emerald-500" />
                                                    <span>{cita.cliente_numero || 'Sin teléfono'}</span>
                                                </div>
                                            </div>

                                            <div className="sm:col-span-5 space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    <Calendar className="w-4 h-4 text-brand-primary" />
                                                    <span>{cita.fecha_inicio}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span>{cita.hora_inicio} hs</span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Servicio: <span className="font-semibold text-slate-700 dark:text-slate-300">{cita.servicios?.nombre || 'General'}</span>
                                                </p>
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

            {/* Modal Agendar Cita Manualmente (Profesional) */}
            {modalAgendarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus className="text-brand-primary" size={20} /> Agendar Cita Manualmente
                            </h3>
                            <button onClick={() => setModalAgendarOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCrearCitaManual} className="space-y-4">
                            {/* Autocompletado / Búsqueda inteligente de clienta */}
                            <div className="relative" ref={sugerenciasRef}>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                    <span>Nombre de la Clienta *</span>
                                    <span className="text-[10px] text-brand-primary font-normal flex items-center gap-1">
                                        <Search size={12} /> Búsqueda inteligente de clienta
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Escribe el nombre o teléfono de la clienta..."
                                    value={nombreClienteForm}
                                    onChange={(e) => {
                                        setNombreClienteForm(e.target.value);
                                        buscarClientasCoincidentes(e.target.value);
                                    }}
                                    onFocus={() => {
                                        if (nombreClienteForm.length >= 2) buscarClientasCoincidentes(nombreClienteForm);
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />

                                {/* Lista de sugerencias coincidentes en tiempo real */}
                                {mostrarSugerencias && sugerenciasClientes.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                                        {sugerenciasClientes.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSeleccionarSugerencia(item)}
                                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-brand-primary">
                                                        {item.nombre}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-mono">
                                                        {item.numero || 'Sin teléfono'}
                                                    </span>
                                                </div>
                                                <Check size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Teléfono WhatsApp *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: 300 123 4567"
                                    value={telefonoClienteForm}
                                    onChange={(e) => {
                                        setTelefonoClienteForm(e.target.value);
                                        if (!nombreClienteForm) buscarClientasCoincidentes(e.target.value);
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Servicio a Realizar *
                                </label>
                                <select
                                    value={servicioIdForm}
                                    onChange={(e) => setServicioIdForm(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                >
                                    {servicios.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.nombre} ({s.duracion_minutos} min) - ${Number(s.valor).toLocaleString('es-CO')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={fechaForm}
                                        onChange={(e) => setFechaForm(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Hora Disponible *
                                    </label>
                                    {cargandoHorariosModal ? (
                                        <div className="text-xs text-slate-400 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse">
                                            Calculando horas libres...
                                        </div>
                                    ) : horariosDisponiblesModal.length === 0 ? (
                                        <div className="text-[11px] text-red-500 py-2.5 px-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800">
                                            No hay horas disponibles en esta fecha.
                                        </div>
                                    ) : (
                                        <select
                                            value={horaForm}
                                            onChange={(e) => setHoraForm(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        >
                                            {horariosDisponiblesModal.map((h) => (
                                                <option key={h} value={h}>
                                                    {h} hs (Disponible)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setModalAgendarOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoCita || horariosDisponiblesModal.length === 0 || !horaForm}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold shadow-md shadow-brand-primary/20 disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    <span>{guardandoCita ? 'Agendando...' : 'Agendar y Notificar'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}