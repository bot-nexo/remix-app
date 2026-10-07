import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Users,
  Sparkles,
  RefreshCw,
  Search
} from 'lucide-react';

interface CitaReporte {
  id: string;
  cliente_nombre: string;
  cliente_numero: string;
  fecha_inicio: string;
  hora_inicio: string;
  estado: string;
  servicios?: {
    id: string;
    nombre: string;
    precio: number;
    duracion_minutos: number;
  } | null;
}

export default function Informes() {
  const { user } = useAuth();
  const { primaryColor, companyName, logoUrl } = useTheme();
  const { showToast } = useToast();

  const [citas, setCitas] = useState<CitaReporte[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroRapido, setFiltroRapido] = useState<'hoy' | 'semana' | 'mes' | '30dias' | 'ano' | 'personalizado'>('mes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // Inicializar fechas según filtro rápido
  useEffect(() => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    if (filtroRapido === 'hoy') {
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (filtroRapido === 'semana') {
      const primerDiaSemana = new Date(hoy);
      const diaSemana = hoy.getDay();
      const diff = diaSemana === 0 ? 6 : diaSemana - 1;
      primerDiaSemana.setDate(hoy.getDate() - diff);
      setFechaDesde(primerDiaSemana.toISOString().split('T')[0]);
      setFechaHasta(hoyStr);
    } else if (filtroRapido === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaDesde(primerDiaMes.toISOString().split('T')[0]);
      const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      setFechaHasta(ultimoDiaMes.toISOString().split('T')[0]);
    } else if (filtroRapido === '30dias') {
      const hace30Dias = new Date(hoy);
      hace30Dias.setDate(hoy.getDate() - 30);
      setFechaDesde(hace30Dias.toISOString().split('T')[0]);
      setFechaHasta(hoyStr);
    } else if (filtroRapido === 'ano') {
      const primerDiaAno = new Date(hoy.getFullYear(), 0, 1);
      setFechaDesde(primerDiaAno.toISOString().split('T')[0]);
      const ultimoDiaAno = new Date(hoy.getFullYear(), 11, 31);
      setFechaHasta(ultimoDiaAno.toISOString().split('T')[0]);
    }
  }, [filtroRapido]);

  // Cargar Citas
  const cargarReporte = async () => {
    if (!user || !fechaDesde || !fechaHasta) return;
    setLoading(true);

    try {
      let query = supabase
        .from('citas')
        .select('id, cliente_nombre, cliente_numero, fecha_inicio, hora_inicio, estado, servicios(id, nombre, valor, duracion_minutos)')
        .eq('user_id', user.id)
        .gte('fecha_inicio', fechaDesde)
        .lte('fecha_inicio', fechaHasta)
        .order('fecha_inicio', { ascending: false })
        .order('hora_inicio', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setCitas((data as any[]) || []);
    } catch (err: any) {
      console.error('[INFORMES] Error cargando datos:', err);
      showToast('Error al cargar la información del reporte.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReporte();
  }, [user, fechaDesde, fechaHasta]);

  // Citas Filtradas
  const citasFiltradas = useMemo(() => {
    return citas.filter((c) => {
      if (filtroEstado !== 'TODOS' && c.estado !== filtroEstado) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const nom = (c.cliente_nombre || '').toLowerCase();
        const tel = (c.cliente_numero || '').toLowerCase();
        const srv = (c.servicios?.nombre || '').toLowerCase();
        return nom.includes(q) || tel.includes(q) || srv.includes(q);
      }
      return true;
    });
  }, [citas, filtroEstado, busqueda]);

  // Métricas Calculadas
  const metricas = useMemo(() => {
    let totalIngresos = 0;
    let completadas = 0;
    let canceladas = 0;
    let agendadas = 0;
    const clientesSet = new Set<string>();
    const serviciosConteo: Record<string, { nombre: string; cantidad: number; ingresos: number }> = {};

    citasFiltradas.forEach((c) => {
      const precio = c.servicios?.valor || 0;
      if (c.cliente_numero) clientesSet.add(c.cliente_numero);

      if (c.estado === 'COMPLETADA') {
        completadas++;
        totalIngresos += precio;
      } else if (c.estado === 'CANCELADA' || c.estado === 'CANCELADO_INASISTENCIA' || c.estado === 'CANCELADO') {
        canceladas++;
      } else {
        agendadas++;
      }

      if (c.servicios?.nombre) {
        const srvKey = c.servicios.nombre;
        if (!serviciosConteo[srvKey]) {
          serviciosConteo[srvKey] = { nombre: srvKey, cantidad: 0, ingresos: 0 };
        }
        serviciosConteo[srvKey].cantidad++;
        if (c.estado === 'COMPLETADA') {
          serviciosConteo[srvKey].ingresos += precio;
        }
      }
    });

    const topServicios = Object.values(serviciosConteo).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

    return {
      totalCitas: citasFiltradas.length,
      totalIngresos,
      completadas,
      canceladas,
      agendadas,
      clientesUnicos: clientesSet.size,
      tasaCumplimiento: citasFiltradas.length > 0 ? Math.round((completadas / citasFiltradas.length) * 100) : 0,
      topServicios,
    };
  }, [citasFiltradas]);

  // Paginación
  const totalPaginas = Math.ceil(citasFiltradas.length / itemsPorPagina) || 1;
  const citasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return citasFiltradas.slice(inicio, inicio + itemsPorPagina);
  }, [citasFiltradas, paginaActual]);

  const formatearMoneda = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // ─── Exportar a Excel (CSV con BOM) ──────────────────────────────────────────
  const exportarAExcel = () => {
    if (citasFiltradas.length === 0) {
      showToast('No hay datos en el reporte para exportar.', 'warning');
      return;
    }

    try {
      const headers = ['Fecha', 'Hora', 'Cliente', 'Teléfono WhatsApp', 'Servicio', 'Estado', 'Valor (COP)'];
      const rows = citasFiltradas.map((c) => [
        `"${c.fecha_inicio}"`,
        `"${c.hora_inicio?.slice(0, 5) || ''}"`,
        `"${(c.cliente_nombre || '').replace(/"/g, '""')}"`,
        `"${c.cliente_numero || ''}"`,
        `"${(c.servicios?.nombre || 'General').replace(/"/g, '""')}"`,
        `"${c.estado}"`,
        c.servicios?.valor || 0,
      ]);

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_Citas_${companyName.replace(/\s+/g, '_')}_${fechaDesde}_a_${fechaHasta}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Reporte Excel descargado exitosamente.', 'success');
    } catch (err: any) {
      console.error('[EXPORT EXCEL]', err);
      showToast('Error al generar el archivo Excel.', 'error');
    }
  };

  // ─── Imprimir / Guardar en PDF ───────────────────────────────────────────────
  const exportarAPDF = () => {
    if (citasFiltradas.length === 0) {
      showToast('No hay citas en este periodo para imprimir.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Permite las ventanas emergentes para generar el PDF.', 'warning');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Informe de Citas - ${companyName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
          .card-val { font-size: 16px; font-weight: bold; color: #0f172a; }
          .card-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #475569; }
          td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .badge-comp { background: #dcfce7; color: #166534; }
          .badge-canc { background: #fee2e2; color: #991b1b; }
          .badge-agend { background: #e0f2fe; color: #075985; }
          .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${companyName} · Informe Ejecutivo</h1>
            <div class="subtitle">Periodo: ${fechaDesde} hasta ${fechaHasta} | Generado el ${new Date().toLocaleDateString('es-CO')}</div>
          </div>
          ${logoUrl ? `<img src="${logoUrl}" style="max-height: 45px; border-radius: 6px;" />` : ''}
        </div>

        <div class="stats">
          <div class="card"><div class="card-val">${formatearMoneda(metricas.totalIngresos)}</div><div class="card-lbl">Ingresos Realizados</div></div>
          <div class="card"><div class="card-val">${metricas.totalCitas}</div><div class="card-lbl">Total Citas</div></div>
          <div class="card"><div class="card-val">${metricas.completadas} (${metricas.tasaCumplimiento}%)</div><div class="card-lbl">Completadas</div></div>
          <div class="card"><div class="card-val">${metricas.canceladas}</div><div class="card-lbl">Canceladas</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Servicio</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${citasFiltradas
              .map(
                (c) => `
              <tr>
                <td>${c.fecha_inicio}</td>
                <td>${c.hora_inicio?.slice(0, 5) || ''}</td>
                <td><b>${c.cliente_nombre || 'Sin nombre'}</b></td>
                <td>${c.cliente_numero || '-'}</td>
                <td>${c.servicios?.nombre || 'General'}</td>
                <td>${formatearMoneda(c.servicios?.valor || 0)}</td>
                <td>
                  <span class="badge ${
                    c.estado === 'COMPLETADA'
                      ? 'badge-comp'
                      : c.estado === 'CANCELADA' || c.estado === 'CANCELADO_INASISTENCIA'
                      ? 'badge-canc'
                      : 'badge-agend'
                  }">
                    ${c.estado}
                  </span>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento oficial generado por el Sistema de Gestión de ${companyName}.
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Generando vista para imprimir/guardar PDF...', 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-brand-primary" />
            Informes & Reportes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Visualiza métricas financieras, de atención y exporta informes a Excel y PDF.
          </p>
        </div>

        {/* Botones de Exportación */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarAExcel}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
            title="Descargar archivo Excel (.csv UTF-8 compatible)"
          >
            <Download size={16} />
            <span>Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={exportarAPDF}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all dark:bg-slate-700 dark:hover:bg-slate-600"
            title="Imprimir o guardar como PDF"
          >
            <Printer size={16} />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filtros Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl">
            {(
              [
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: 'Esta Semana' },
                { id: 'mes', label: 'Este Mes' },
                { id: '30dias', label: 'Últimos 30 días' },
                { id: 'ano', label: 'Todo el Año' },
                { id: 'personalizado', label: 'Personalizado' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroRapido(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filtroRapido === f.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Selector de Rango de Fechas */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setFiltroRapido('personalizado');
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setFiltroRapido('personalizado');
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <button
              type="button"
              onClick={cargarReporte}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filtros Secundarios: Estado y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 font-medium">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="COMPLETADA">Completadas</option>
              <option value="AGENDADO">Agendadas</option>
              <option value="EN_ESPERA">En Espera (Llegó)</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="CANCELADO_INASISTENCIA">Inasistencia</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente o servicio..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos Realizados */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ingresos Realizados</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {formatearMoneda(metricas.totalIngresos)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Citas completadas en el periodo</p>
          </div>
        </div>

        {/* Total Citas */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Citas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Calendar size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{metricas.totalCitas}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{metricas.clientesUnicos} clientes únicos</p>
          </div>
        </div>

        {/* Tasa de Cumplimiento */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cumplimiento</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{metricas.tasaCumplimiento}%</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{metricas.completadas} completadas de {metricas.totalCitas}</p>
          </div>
        </div>

        {/* Canceladas */}
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Canceladas / Inasist.</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <XCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{metricas.canceladas}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{metricas.agendadas} citas aún pendientes</p>
          </div>
        </div>
      </div>

      {/* Grid Secundario: Top Servicios y Resumen */}
      {metricas.topServicios.length > 0 && (
        <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-primary" />
            Servicios más Solicitados en este Periodo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metricas.topServicios.map((srv, idx) => (
              <div
                key={srv.nombre}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">
                    #{idx + 1} {srv.nombre}
                  </span>
                  <span className="text-[10px] text-slate-400">{srv.cantidad} citas realizadas</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                    {formatearMoneda(srv.ingresos)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla Detallada de Citas */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Listado Detallado de Citas ({citasFiltradas.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-900/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3 px-4">Fecha & Hora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Teléfono</th>
                <th className="py-3 px-4">Servicio</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Cargando reporte de citas...
                  </td>
                </tr>
              ) : citasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron citas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                citasPaginadas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                      <div>{c.fecha_inicio}</div>
                      <div className="text-[10px] text-slate-400">{c.hora_inicio?.slice(0, 5)} hs</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {c.cliente_nombre || 'Cliente sin nombre'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {c.cliente_numero || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {c.servicios?.nombre || 'General'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {formatearMoneda(c.servicios?.valor || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.estado === 'COMPLETADA'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : c.estado === 'CANCELADA' || c.estado === 'CANCELADO_INASISTENCIA' || c.estado === 'CANCELADO'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {c.estado === 'COMPLETADA' ? 'Completada' : c.estado === 'CANCELADA' ? 'Cancelada' : c.estado === 'CANCELADO_INASISTENCIA' ? 'Inasistencia' : 'Agendada'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Página {paginaActual} de {totalPaginas}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
