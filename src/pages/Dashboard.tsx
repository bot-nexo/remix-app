import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, DollarSign, Activity, Clock } from 'lucide-react';

interface Cita {
  id: string;
  cliente_nombre: string;
  cliente_numero: string;
  fecha_inicio: string;
  estado: string;
  servicios: { nombre: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [citasHoy, setCitasHoy] = useState(0);
  const [citasSemana, setCitasSemana] = useState(0);
  const [ventasMes, setVentasMes] = useState(0);
  const [proximasCitas, setProximasCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      setLoading(true);

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      try {
        // Citas Hoy
        const { count: hoyCount } = await supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('fecha_inicio', todayStart)
          .lte('fecha_inicio', todayEnd);

        setCitasHoy(hoyCount || 0);

        // Citas Semana
        const { count: semanaCount } = await supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('fecha_inicio', weekStart.toISOString())
          .lte('fecha_inicio', weekEnd.toISOString());

        setCitasSemana(semanaCount || 0);

        // Para las ventas, habría que unir con servicios para ver el valor
        const { data: citasMes } = await supabase
          .from('citas')
          .select(`
            estado,
            servicios ( valor )
          `)
          .eq('user_id', user.id)
          .gte('fecha_inicio', monthStart)
          .eq('estado', 'completada');

        const totalVentas = citasMes?.reduce((acc, cita) => {
          const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios;
          return acc + (Number(servicio?.valor) || 0);
        }, 0) || 0;

        setVentasMes(totalVentas);

        // Próximas citas (futuras)
        const currentIso = new Date().toISOString();
        const { data: prox } = await supabase
          .from('citas')
          .select(`
            id,
            cliente_nombre,
            cliente_numero,
            fecha_inicio,
            estado,
            servicios ( nombre )
          `)
          .eq('user_id', user.id)
          .gte('fecha_inicio', currentIso)
          .order('fecha_inicio', { ascending: true })
          .limit(5);

        setProximasCitas((prox as any) || []);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel de Control</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Resumen general de tu negocio</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Citas Hoy"
          value={loading ? '-' : citasHoy.toString()}
          icon={<Calendar className="w-6 h-6 text-brand-primary" />}
        />
        <MetricCard
          title="Citas Esta Semana"
          value={loading ? '-' : citasSemana.toString()}
          icon={<Activity className="w-6 h-6 text-brand-primary" />}
        />
        <MetricCard
          title="Ventas del Mes"
          value={loading ? '-' : `$${ventasMes.toLocaleString()}`}
          icon={<DollarSign className="w-6 h-6 text-brand-primary" />}
        />
      </div>

      {/* Próximas Citas */}
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-primary" />
            Próximas Citas
          </h3>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando citas...</div>
          ) : proximasCitas.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No hay próximas citas programadas.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {proximasCitas.map((cita) => (
                <li key={cita.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium text-slate-900 dark:text-white">{cita.cliente_nombre}</p>
                      <p className="text-xs text-slate-500">{cita.cliente_numero}</p>
                    </div>
                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter bg-brand-primary/10 text-brand-primary border border-transparent dark:border-brand-primary/20">
                        {cita.estado}
                      </span>
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                        {new Date(cita.fecha_inicio).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
        {icon} {title}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900 dark:text-white">{value}</span>
      </div>
    </div>
  );
}
