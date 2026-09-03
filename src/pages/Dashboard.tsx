import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { CitaResumen, ServicioPopular } from '../types/types';
import {
  Calendar, DollarSign, Activity, TrendingUp, Target, EyeOff, Eye,
  UserCheck, Award, Clock, ArrowUpRight, ArrowDownRight, Users, UserPlus, AlertTriangle
} from 'lucide-react';


export default function Dashboard() {
  const { user } = useAuth();
  const { companyName } = useTheme();
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
  const [metaVentas, setMetaVentas] = useState(5000000);

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
      // 0. Cargar meta de ventas desde configuracion
      const { data: configData } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('user_id', user.id)
        .eq('clave', 'meta_ventas_mes')
        .limit(1)
        .maybeSingle();
      if (configData?.valor) {
        const meta = parseInt(configData.valor, 10);
        if (!isNaN(meta) && meta > 0) setMetaVentas(meta);
      }

      // 1. Citas Hoy
      const { count: hoyCount } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('fecha_inicio', hoyLocal);
      setCitasHoy(hoyCount || 0);

      // 2. Citas Esta Semana
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
        .select(`id, cliente_numero, cliente_nombre, estado, servicio_id, servicios ( nombre, valor )`)
        .eq('user_id', user.id)
        .gte('fecha_inicio', monthStartStr);

      if (errorCitas) console.error("Error al obtener citas del mes:", errorCitas);

      const completadas = citasMes?.filter(c => {
        const est = c.estado?.toString().trim().toUpperCase();
        return est === 'COMPLETADA' || est === 'COMPLETADO' || est === 'REALIZADA';
      }) || [];

      const canceladas = citasMes?.filter(c => {
        const est = c.estado?.toString().trim().toUpperCase();
        return est === 'CANCELADO_INASISTENCIA' || est === 'INASISTENCIA' || est === 'CANCELADA';
      }) || [];

      setInasistenciasMes(canceladas.length);

      const totalVentasActual = completadas.reduce((acc, cita: any) => {
        const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios;
        return acc + (Number(servicio?.valor) || 0);
      }, 0);
      setVentasMes(totalVentasActual);
      setTicketPromedio(completadas.length > 0 ? Math.round(totalVentasActual / completadas.length) : 0);

      const totalEvaluadas = completadas.length + canceladas.length;
      setTasaAsistencia(totalEvaluadas > 0 ? Math.round((completadas.length / totalEvaluadas) * 100) : 100);

      const numerosUnicos = new Set(citasMes?.map(c => c.cliente_numero).filter(Boolean));
      setClientesNuevos(numerosUnicos.size);
      setPorcentajeCumplimiento(metaVentas > 0 ? Math.min(Math.round((totalVentasActual / metaVentas) * 100), 100) : 0);

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

      // 5. Agenda de Hoy
      const { data: hoyList } = await supabase
        .from('citas')
        .select(`id, cliente_nombre, hora_inicio, estado, servicios ( nombre )`)
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
        .map(([nombre, total]) => ({ nombre, total, porcentaje: Math.round((total / totalServicios) * 100) }))
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hola, {companyName} 👋</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Resumen de tu negocio de hoy
          </p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 hidden md:block">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* FILA 1: KPIs PRINCIPALES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard
          title="Hoy"
          value={loading ? '—' : citasHoy.toString()}
          subtitle="citas programadas"
          icon={<Calendar className="w-4 h-4" />}
          color="brand"
        />
        <KPICard
          title="Semana"
          value={loading ? '—' : citasSemana.toString()}
          subtitle="citas esta semana"
          icon={<Activity className="w-4 h-4" />}
          color="blue"
        />
        <KPICard
          title="Ventas"
          value={loading ? '—' : `$${ventasMes.toLocaleString('es-CO')}`}
          subtitle="del mes actual"
          icon={<DollarSign className="w-4 h-4" />}
          color="emerald"
          esMoneda
          mostrado={mostrarVentas}
          onToggle={() => setMostrarVentas(prev => !prev)}
        />
        <KPICard
          title="Ticket"
          value={loading ? '—' : `$${ticketPromedio.toLocaleString('es-CO')}`}
          subtitle="promedio por cita"
          icon={<Award className="w-4 h-4" />}
          color="purple"
          esMoneda
          mostrado={mostrarTicket}
          onToggle={() => setMostrarTicket(prev => !prev)}
        />
      </div>

      {/* FILA 2: RENDIMIENTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Meta de Ventas */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meta del Mes</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {porcentajeCumplimiento}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${porcentajeCumplimiento}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>${ventasMes.toLocaleString('es-CO')}</span>
            <span>${metaVentas.toLocaleString('es-CO')}</span>
          </div>
        </div>

        {/* Crecimiento */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">vs Mes Anterior</p>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${crecimiento >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {crecimiento >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <span className={`text-2xl font-black ${crecimiento >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {crecimiento >= 0 ? `+${crecimiento}%` : `${crecimiento}%`}
              </span>
              <p className="text-[11px] text-slate-400">crecimiento</p>
            </div>
          </div>
        </div>

        {/* Tasa de Asistencia */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Asistencia</p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{tasaAsistencia}%</span>
            <div className="flex-1 pb-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-violet-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${tasaAsistencia}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILA 3: AGENDA + SERVICIOS + CLIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Agenda de Hoy */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-primary" /> Agenda de Hoy
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
              {proximasHoy.length} citas
            </span>
          </div>

          <div className="p-3">
            {proximasHoy.length === 0 ? (
              <div className="py-10 text-center">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Sin citas para hoy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proximasHoy.map((cita) => (
                  <div key={cita.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {cita.cliente_nombre?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{cita.cliente_nombre || 'Sin nombre'}</p>
                      <p className="text-[11px] text-slate-400">{cita.servicios?.nombre || 'Servicio'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-medium">{cita.hora_inicio?.slice(0, 5) || '--:--'}</span>
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cita.estado === 'COMPLETADA' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' :
                          cita.estado === 'EN_ESPERA' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                          }`}>
                          {cita.estado === 'COMPLETADA' ? 'Hecha' : cita.estado === 'EN_ESPERA' ? 'Espera' : cita.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demanda por Servicio */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" /> Servicios Populares
            </h3>
            <span className="text-[11px] text-slate-400">este mes</span>
          </div>

          <div className="p-5">
            {serviciosTop.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Sin datos este mes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {serviciosTop.map((srv, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{srv.nombre}</span>
                      <span className="text-slate-400">{srv.porcentaje}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
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
        </div>

        {/* Actividad de Clientes */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" /> Clientes
            </h3>
            <span className="text-[11px] text-slate-400">este mes</span>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Clientes Atendidos</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{clientesNuevos}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Inasistencias</span>
              </div>
              <span className="text-lg font-bold text-rose-500">{inasistenciasMes}</span>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Contacta a tus clientes antes de la cita para reducir inasistencias.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, color, esMoneda = false, mostrado = true, onToggle }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode;
  color: 'brand' | 'blue' | 'emerald' | 'purple';
  esMoneda?: boolean; mostrado?: boolean; onToggle?: () => void;
}) {
  const colorMap = {
    brand: 'bg-brand-primary/10 text-brand-primary',
    blue: 'bg-blue-500/10 text-blue-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    purple: 'bg-violet-500/10 text-violet-500',
  };

  return (
    <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 relative group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        {esMoneda && onToggle && (
          <button
            onClick={onToggle}
            className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
            title={mostrado ? "Ocultar" : "Mostrar"}
          >
            {mostrado ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">{title}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
          {esMoneda && !mostrado ? '••••••' : value}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
