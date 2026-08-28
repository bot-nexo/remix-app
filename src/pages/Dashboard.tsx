import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CitaResumen, ServicioPopular } from '../types/types';
import {
  Calendar, DollarSign, Activity, TrendingUp, Target, EyeOff, Eye,
  UserCheck, Award, Clock, ArrowUpRight, ArrowDownRight, Users, UserPlus, AlertTriangle
} from 'lucide-react';


export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Estados independientes para ocultar/mostrar valores
  const [mostrarVentas, setMostrarVentas] = useState(false);
  const [mostrarTicket, setMostrarTicket] = useState(false);

  // Métricas Principales
  const [citasHoy, setCitasHoy] = useState(0);
  const [citasSemana, setCitasSemana] = useState(0);
  const [ventasMes, setVentasMes] = useState(0);
  const [porcentajeCumplimiento, setPorcentajeCumplimiento] = useState(0);
  const [crecimiento, setCrecimiento] = useState(0);

  // Métricas Complementarias
  const [ticketPromedio, setTicketPromedio] = useState(0);
  const [tasaAsistencia, setTasaAsistencia] = useState(100);
  const [clientesNuevos, setClientesNuevos] = useState(0);
  const [inasistenciasMes, setInasistenciasMes] = useState(0);

  const [proximasHoy, setProximasHoy] = useState<CitaResumen[]>([]);
  const [serviciosTop, setServiciosTop] = useState<ServicioPopular[]>([]);

  const META_VENTAS_MES = 5000000;

  //****************** */
  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    // Fechas en formato ISO local (YYYY-MM-DD)
    const now = new Date();
    const hoyLocal = now.toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

    // Rango de la semana actual (Lunes a Domingo)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);
    const weekStartStr = startOfWeek.toLocaleDateString('en-CA');

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekEndStr = endOfWeek.toLocaleDateString('en-CA');

    // Primer día del mes actual
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Mes anterior
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStartStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonthEndStr = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA');

    try {
      // 1. Citas Hoy (ÚNICAMENTE del día de hoy)
      const { count: hoyCount } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('fecha_inicio', hoyLocal);

      setCitasHoy(hoyCount || 0);

      // 2. Citas Esta Semana (Lunes a Domingo)
      const { count: semanaCount } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('fecha_inicio', weekStartStr)
        .lte('fecha_inicio', weekEndStr);

      setCitasSemana(semanaCount || 0);

      // 3. Citas y Ventas del Mes
      const { data: citasMes, error: errorCitas } = await supabase
        .from('citas')
        .select(`
        id,
        cliente_numero,
        cliente_nombre,
        estado,
        servicio_id,
        servicios ( nombre, valor )
      `)
        .eq('user_id', user.id)
        .gte('fecha_inicio', monthStartStr);

      if (errorCitas) console.error("Error al obtener citas del mes:", errorCitas);

      // Normalización de estados
      // console.log("citasmes", citasMes);
      const completadas = citasMes?.filter(c => {
        const est = c.estado?.toString().trim().toUpperCase();
        return est === 'COMPLETADA' || est === 'COMPLETADO' || est === 'REALIZADA';
      }) || [];

      const canceladas = citasMes?.filter(c => {
        const est = c.estado?.toString().trim().toUpperCase();
        return est === 'CANCELADO_INASISTENCIA' || est === 'INASISTENCIA' || est === 'CANCELADA';
      }) || [];

      setInasistenciasMes(canceladas.length);
      // console.log("cpletadas", completadas);

      // Suma de ventas considerando servicios enlazados
      const totalVentasActual = completadas.reduce((acc, cita: any) => {
        const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios;
        // console.log("totalVentasActual1", servicio);
        const valorServicio = Number(servicio?.valor) || 0;
        // console.log("totalVentasActua2l", valorServicio);
        return acc + valorServicio;
      }, 0);
      // console.log("totalVentasActual3", totalVentasActual);
      setVentasMes(totalVentasActual);

      // Ticket Promedio
      setTicketPromedio(completadas.length > 0 ? Math.round(totalVentasActual / completadas.length) : 0);

      // Tasa de Asistencia
      const totalEvaluadas = completadas.length + canceladas.length;
      setTasaAsistencia(totalEvaluadas > 0 ? Math.round((completadas.length / totalEvaluadas) * 100) : 100);

      // Clientes Únicos del Mes
      const numerosUnicos = new Set(citasMes?.map(c => c.cliente_numero).filter(Boolean));
      setClientesNuevos(numerosUnicos.size);

      // Porcentaje de Cumplimiento de Meta
      setPorcentajeCumplimiento(Math.min(Math.round((totalVentasActual / META_VENTAS_MES) * 100), 100));

      // 4. Crecimiento vs Mes Anterior
      const { data: citasMesAnterior } = await supabase
        .from('citas')
        .select(`estado, servicios ( valor )`)
        .eq('user_id', user.id)
        .gte('fecha_inicio', lastMonthStartStr)
        .lte('fecha_inicio', lastMonthEndStr);

      const completadasAnterior = citasMesAnterior?.filter(c => {
        const est = c.estado?.toString().trim().toUpperCase();
        return est === 'COMPLETADA' || est === 'COMPLETADO';
      }) || [];

      const totalVentasAnterior = completadasAnterior.reduce((acc, cita: any) => {
        const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios;
        return acc + (Number(servicio?.valor) || 0);
      }, 0);

      if (totalVentasAnterior > 0) {
        setCrecimiento(Math.round(((totalVentasActual - totalVentasAnterior) / totalVentasAnterior) * 100));
      } else {
        setCrecimiento(totalVentasActual > 0 ? 100 : 0);
      }

      // 5. Agenda de Hoy (Próximas 4 citas del día)
      const { data: hoyList } = await supabase
        .from('citas')
        .select(`
        id,
        cliente_nombre,
        hora_inicio,
        estado,
        servicios ( nombre )
      `)
        .eq('user_id', user.id)
        .eq('fecha_inicio', hoyLocal)
        .order('hora_inicio', { ascending: true })
        .limit(4);

      setProximasHoy((hoyList as any) || []);

      // 6. Demanda por Servicio
      const mapaServicios: Record<string, number> = {};
      (citasMes as any[])?.forEach((c) => {
        const servicio = Array.isArray(c.servicios) ? c.servicios[0] : c.servicios;
        const sNombre = servicio?.nombre || 'Otros';
        mapaServicios[sNombre] = (mapaServicios[sNombre] || 0) + 1;
      });

      const totalServicios = Object.values(mapaServicios).reduce((a, b) => a + b, 0) || 1;
      const topServicios = Object.entries(mapaServicios)
        .map(([nombre, total]) => ({
          nombre,
          total,
          porcentaje: Math.round((total / totalServicios) * 100)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4);

      setServiciosTop(topServicios);

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  //****************** */
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel Informativo</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Visión general del rendimiento, métricas operativas y salud de tu negocio
        </p>
      </div>

      {/* FILA 1: CARDS MÁS IMPORTANTES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <MetricCard
          title="Citas Hoy"
          value={loading ? '-' : citasHoy.toString()}
          subtext="Programadas para hoy"
          icon={<Calendar className="w-5 h-5 text-brand-primary" />}
        />
        <MetricCard
          title="Citas Esta Semana"
          value={loading ? '-' : citasSemana.toString()}
          subtext="En los últimos 7 días"
          icon={<Activity className="w-5 h-5 text-brand-primary" />}
        />
        <MetricCard
          title="Ventas del Mes"
          value={loading ? '-' : `$${ventasMes.toLocaleString('es-CO')}`}
          subtext="Solo completadas"
          icon={<DollarSign className="w-5 h-5 text-brand-primary" />}
          esMoneda={true}
          mostrado={mostrarVentas}
          onToggle={() => setMostrarVentas(prev => !prev)}
        />
        <MetricCard
          title="Ticket Promedio"
          value={loading ? '-' : `$${ticketPromedio.toLocaleString('es-CO')}`}
          subtext="Ingreso medio por cita"
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          esMoneda={true}
          mostrado={mostrarTicket}
          onToggle={() => setMostrarTicket(prev => !prev)}
        />
      </div>

      {/* FILA 2: RENDIMIENTO Y METAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meta de Ventas */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" /> Meta de Ventas Mes
            </p>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {porcentajeCumplimiento}%
            </span>
          </div>
          <div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${porcentajeCumplimiento}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Actual: ${ventasMes.toLocaleString('es-CO')}</span>
              <span>Meta: ${META_VENTAS_MES.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>

        {/* Crecimiento Comparativo */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Crecimiento vs Mes Pasado
          </p>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${crecimiento >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {crecimiento >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
            </div>
            <div>
              <span className={`text-2xl font-black ${crecimiento >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {crecimiento >= 0 ? `+${crecimiento}%` : `${crecimiento}%`}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">Comparado al mes anterior</p>
            </div>
          </div>
        </div>

        {/* Tasa de Asistencia */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-purple-400" /> Tasa de Asistencia
          </p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-white">{tasaAsistencia}%</span>
            <div className="flex-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${tasaAsistencia}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">Asistencias eficientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILA 3: INFORMACIÓN OPERATIVA Y CLIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Agenda de Hoy en Vistazo Rápido */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-primary" /> Agenda de Hoy
            </h3>
            <span className="text-xs text-slate-400 font-medium">{proximasHoy.length} citas</span>
          </div>

          {proximasHoy.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No tienes citas agendadas para hoy.</div>
          ) : (
            <div className="space-y-3">
              {proximasHoy.map((cita) => (
                <div key={cita.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                      {cita.cliente_nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{cita.cliente_nombre}</p>
                      <p className="text-[10px] text-slate-400">{cita.servicios?.nombre || 'Servicio'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs text-slate-300 font-medium">{cita.hora_inicio.slice(0, 5)}</span>
                    <div className="mt-0.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cita.estado === 'COMPLETADA' ? 'bg-emerald-500/10 text-emerald-400' :
                        cita.estado === 'EN_ESPERA' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                        {cita.estado}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribución de Servicios (Distribución % sobre Citas Solicitadas) */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" /> Demanda por Servicio
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Cuota del mes</span>
          </div>

          {serviciosTop.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Sin datos registrados este mes.</div>
          ) : (
            <div className="space-y-4">
              {serviciosTop.map((srv, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{srv.nombre}</span>
                    <span className="text-slate-400">{srv.total} citas ({srv.porcentaje}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${srv.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen de Clientes e Inasistencias */}
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" /> Actividad de Clientes
              </h3>
              <span className="text-[10px] text-slate-400">Este mes</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-300 font-medium">Clientes Activos</span>
                </div>
                <span className="text-sm font-bold text-white">{clientesNuevos}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-slate-300 font-medium">Inasistencias / Faltas</span>
                </div>
                <span className="text-sm font-bold text-rose-400">{inasistenciasMes}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 text-[11px] text-slate-500 border-t border-slate-800/80">
            💡 Mantén la tasa de inasistencias baja contactando previamente a los clientes antes de la cita.
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, subtext, icon, esMoneda = false, mostrado = true, onToggle }: { title: string; value: string; subtext: string; icon: React.ReactNode, esMoneda?: boolean, mostrado?: boolean, onToggle?: () => void }) {
  return (
    <div className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          {icon} {title}
        </p>
        {esMoneda && onToggle && (
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
            title={mostrado ? "Ocultar monto" : "Mostrar monto"}
          >
            {mostrado ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4 text-brand-primary" />}
          </button>
        )}
      </div>
      <div>
        <span className="text-2xl font-black text-slate-900 dark:text-white">
          {esMoneda && !mostrado ? '*********' : value}
        </span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>
      </div>
    </div>
  );
}