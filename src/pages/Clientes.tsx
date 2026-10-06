import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Edit2,
  Trash2,
  Eye,
  X,
  UserCheck,
  Clock,
  Sparkles,
  Filter,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { Cliente, Cita } from '../types/types';
import {
  obtenerClientesPaginados,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  obtenerHistorialCliente,
} from '../services/clientesService';

export default function Clientes() {
  const { showToast } = useToast();

  // Estados de datos y paginación
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [limitePorPagina, setLimitePorPagina] = useState(10);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [orden, setOrden] = useState<'reciente' | 'antiguo' | 'nombre_asc' | 'nombre_desc'>('reciente');

  // Cargando
  const [loading, setLoading] = useState(true);

  // Modales
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [nombreForm, setNombreForm] = useState('');
  const [numeroForm, setNumeroForm] = useState('');
  const [guardandoForm, setGuardandoForm] = useState(false);

  // Modal Historial
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [citasHistorial, setCitasHistorial] = useState<Cita[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Modal Enviar Mensaje WhatsApp
  const [modalWaOpen, setModalWaOpen] = useState(false);
  const [mensajeWa, setMensajeWa] = useState('');

  // Estado Lista Blanca
  const [whiteListPhones, setWhiteListPhones] = useState<Set<string>>(new Set());

  // Cargar lista blanca desde Supabase
  const cargarListaBlanca = async () => {
    try {
      const { data } = await supabase
        .from('lista_blanca')
        .select('numero_whatsapp');

      if (data) {
        const phonesSet = new Set<string>();
        data.forEach((row) => {
          if (row.numero_whatsapp) {
            phonesSet.add(row.numero_whatsapp.replace(/\D/g, ''));
          }
        });
        setWhiteListPhones(phonesSet);
      }
    } catch (err) {
      console.warn('[CLIENTES] Error cargando lista blanca:', err);
    }
  };

  useEffect(() => {
    cargarListaBlanca();
  }, []);

  const handleToggleListaBlanca = async (cliente: Cliente) => {
    if (!cliente.numero) {
      showToast('Este cliente no tiene un teléfono registrado.', 'error');
      return;
    }

    const cleanPhone = cliente.numero.replace(/\D/g, '');
    const isCurrentlyWhitelisted = Array.from(whiteListPhones).some(
      (p) => p.endsWith(cleanPhone) || cleanPhone.endsWith(p)
    );

    try {
      if (isCurrentlyWhitelisted) {
        // Eliminar de la lista blanca
        const { error } = await supabase
          .from('lista_blanca')
          .delete()
          .ilike('numero_whatsapp', `%${cleanPhone}%`);

        if (error) throw error;

        const newSet = new Set(whiteListPhones);
        newSet.delete(cleanPhone);
        setWhiteListPhones(newSet);
        showToast(`"${cliente.nombre}" removido(a) de la Lista Blanca. El bot volverá a responderle.`, 'warning');
      } else {
        // Agregar a la lista blanca
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const { error } = await supabase
          .from('lista_blanca')
          .insert({
            user_id: userId,
            nombre: cliente.nombre,
            numero_whatsapp: cliente.numero,
          });

        if (error) throw error;

        const newSet = new Set(whiteListPhones);
        newSet.add(cleanPhone);
        setWhiteListPhones(newSet);
        showToast(`¡"${cliente.nombre}" agregado(a) a la Lista Blanca! El bot lo ignorará siempre (Contacto Excluido).`, 'success');
      }
    } catch (err: any) {
      showToast(`Error en Lista Blanca: ${err?.message || 'Error de base de datos'}`, 'error');
    }
  };

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setPaginaActual(1); // Reiniciar a página 1 cuando busca
    }, 400);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Cargar clientes al cambiar página, filtro u orden
  const cargarClientes = async () => {
    setLoading(true);
    try {
      const res = await obtenerClientesPaginados({
        pagina: paginaActual,
        limite: limitePorPagina,
        busqueda: busquedaDebounced,
        orden,
      });

      setClientes(res.clientes);
      setTotalClientes(res.total);
      setTotalPaginas(res.totalPaginas);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, [paginaActual, limitePorPagina, busquedaDebounced, orden]);

  // Manejo de Formulario (Crear/Editar)
  const handleAbrirCrear = () => {
    setClienteEditando(null);
    setNombreForm('');
    setNumeroForm('');
    setModalClienteOpen(true);
  };

  const handleAbrirEditar = (c: Cliente) => {
    setClienteEditando(c);
    setNombreForm(c.nombre);
    setNumeroForm(c.numero || '');
    setModalClienteOpen(true);
  };

  const handleGuardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreForm.trim()) {
      showToast('Por favor ingresa el nombre del cliente.', 'warning');
      return;
    }

    setGuardandoForm(true);
    try {
      if (clienteEditando) {
        await actualizarCliente(clienteEditando.id, {
          nombre: nombreForm,
          numero: numeroForm,
        });
        showToast('Cliente actualizado correctamente.', 'success');
      } else {
        await crearCliente({
          nombre: nombreForm,
          numero: numeroForm,
        });
        showToast('Cliente creado exitosamente.', 'success');
      }
      setModalClienteOpen(false);
      cargarClientes();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar cliente.', 'error');
    } finally {
      setGuardandoForm(false);
    }
  };

  const handleEliminarCliente = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) return;

    try {
      await eliminarCliente(id);
      showToast('Cliente eliminado de la base de datos.', 'success');
      cargarClientes();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar cliente.', 'error');
    }
  };

  // Abrir Historial de Citas
  const handleVerHistorial = async (c: Cliente) => {
    setClienteSeleccionado(c);
    setModalHistorialOpen(true);
    if (!c.numero) {
      setCitasHistorial([]);
      return;
    }

    setLoadingHistorial(true);
    try {
      const historial = await obtenerHistorialCliente(c.numero);
      setCitasHistorial(historial);
    } catch (err) {
      showToast('Error al cargar historial de citas.', 'error');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Abrir Modal de WhatsApp
  const handleAbrirWhatsApp = (c: Cliente) => {
    setClienteSeleccionado(c);
    setMensajeWa(`Hola ${c.nombre}, ¡te escribimos desde Angel Nails! ✨ ¿En qué te podemos colaborar hoy?`);
    setModalWaOpen(true);
  };

  const handleEnviarWhatsAppDirecto = () => {
    if (!clienteSeleccionado?.numero) {
      showToast('El cliente no posee un número de WhatsApp registrado.', 'warning');
      return;
    }
    const cleanNum = clienteSeleccionado.numero.replace(/\D/g, '');
    const encoded = encodeURIComponent(mensajeWa);
    window.open(`https://wa.me/${cleanNum}?text=${encoded}`, '_blank');
    setModalWaOpen(false);
  };

  // Rango para paginación
  const desdeItem = totalClientes === 0 ? 0 : (paginaActual - 1) * limitePorPagina + 1;
  const hastaItem = Math.min(paginaActual * limitePorPagina, totalClientes);

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-brand-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Users size={16} /> Módulo Operativo
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Directorio de Clientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Consulta, busca y gestiona los clientes agendados en tu centro de atención.
          </p>
        </div>

        <button
          onClick={handleAbrirCrear}
          className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-md shadow-brand-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={18} />
          <span>Agregar Cliente</span>
        </button>
      </div>

      {/* Tarjetas de Estadísticas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Clientes</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalClientes}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Phone size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Con WhatsApp</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {clientes.filter((c) => c.numero).length} <span className="text-xs font-normal text-slate-400">(en esta pág)</span>
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Página Actual</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {paginaActual} <span className="text-xs font-normal text-slate-400">de {totalPaginas}</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Paginación */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Selector Ordenamiento y Límite */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Orden */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300">
              <Filter size={14} className="text-slate-400" />
              <span>Orden:</span>
              <select
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value as any);
                  setPaginaActual(1);
                }}
                className="bg-transparent font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="reciente">Más Recientes</option>
                <option value="antiguo">Más Antiguos</option>
                <option value="nombre_asc">Nombre A-Z</option>
                <option value="nombre_desc">Nombre Z-A</option>
              </select>
            </div>

            {/* Elementos por página */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300">
              <span>Mostrar:</span>
              <select
                value={limitePorPagina}
                onChange={(e) => {
                  setLimitePorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="bg-transparent font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value={5}>5 por pág.</option>
                <option value={10}>10 por pág.</option>
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
              </select>
            </div>

            {/* Recargar */}
            <button
              onClick={cargarClientes}
              title="Recargar datos"
              className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Clientes Paginada */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-primary border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cargando directorio de clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
            <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">No se encontraron clientes</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {busqueda ? 'No hay resultados que coincidan con tu búsqueda.' : 'Aún no tienes clientes registrados en tu base de datos.'}
            </p>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="mt-4 text-xs font-semibold text-brand-primary hover:underline"
              >
                Limpiar filtro de búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Cliente</th>
                  <th className="py-3.5 px-4">Teléfono WhatsApp</th>
                  <th className="py-3.5 px-4">Exclusión Bot (Lista Blanca)</th>
                  <th className="py-3.5 px-4">Fecha de Registro</th>
                  <th className="py-3.5 px-4 text-center">Historial</th>
                  <th className="py-3.5 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {clientes.map((c) => {
                  const initial = c.nombre ? c.nombre.charAt(0).toUpperCase() : '?';
                  const fechaReg = c.created_at
                    ? new Date(c.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A';

                  const cleanPhone = c.numero ? c.numero.replace(/\D/g, '') : '';
                  const isWhitelisted = cleanPhone && Array.from(whiteListPhones).some(
                    (p) => p.endsWith(cleanPhone) || cleanPhone.endsWith(p)
                  );

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Cliente (Nombre + Avatar) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-indigo-600 text-white font-bold flex items-center justify-center shadow-sm shrink-0">
                            {initial}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block group-hover:text-brand-primary transition-colors">
                              {c.nombre}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              ID: {c.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp / Teléfono */}
                      <td className="py-4 px-4 font-mono text-xs">
                        {c.numero ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/80 dark:border-emerald-800/60">
                            <Phone size={13} />
                            <span>{c.numero}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 italic text-xs">Sin registrar</span>
                        )}
                      </td>

                      {/* Exclusión Bot (Lista Blanca) */}
                      <td className="py-4 px-4">
                        {c.numero ? (
                          <button
                            type="button"
                            onClick={() => handleToggleListaBlanca(c)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                              isWhitelisted
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40'
                            }`}
                            title={isWhitelisted ? 'Contacto Excluido del bot (Familiar/Amigo). El bot lo ignora. Haz clic para reactivar el bot.' : 'Haz clic para incluir en la Lista Blanca e ignorar con el bot (Esposo, hijos, padres, etc.)'}
                          >
                            {isWhitelisted ? (
                              <>
                                <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
                                <span>Excluido del Bot</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={14} className="text-slate-400" />
                                <span>Bot Activo</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Fecha de Registro */}
                      <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{fechaReg}</span>
                        </div>
                      </td>

                      {/* Ver Historial */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleVerHistorial(c)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-primary dark:hover:text-brand-primary bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                          <span>Ver Citas</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.numero && (
                            <button
                              onClick={() => handleAbrirWhatsApp(c)}
                              title="Enviar WhatsApp"
                              className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl transition-colors"
                            >
                              <MessageSquare size={17} />
                            </button>
                          )}
                          <button
                            onClick={() => handleAbrirEditar(c)}
                            title="Editar cliente"
                            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <Edit2 size={17} />
                          </button>
                          <button
                            onClick={() => handleEliminarCliente(c.id, c.nombre)}
                            title="Eliminar cliente"
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl transition-colors"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer de Paginación */}
        {!loading && totalClientes > 0 && (
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Mostrando <span className="font-bold text-slate-800 dark:text-slate-200">{desdeItem}</span> a{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{hastaItem}</span> de{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{totalClientes}</span> clientes
            </div>

            {/* Navegación de Páginas */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Botones de Páginas */}
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 1)
                .map((num, index, arr) => {
                  const showEllipsisBefore = index > 0 && num - arr[index - 1] > 1;
                  return (
                    <React.Fragment key={num}>
                      {showEllipsisBefore && (
                        <span className="px-2 text-xs text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => setPaginaActual(num)}
                        className={`min-w-[34px] h-[34px] px-2.5 rounded-xl text-xs font-bold transition-all ${
                          paginaActual === num
                            ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Página Siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Cliente */}
      {modalClienteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {clienteEditando ? 'Editar Datos de Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button
                onClick={() => setModalClienteOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: María Paula Gómez"
                  value={nombreForm}
                  onChange={(e) => setNombreForm(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Número Telefónico (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="Ej: +57 300 123 4567"
                  value={numeroForm}
                  onChange={(e) => setNumeroForm(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Incluye el código de país si deseas enviar mensajes por WhatsApp.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalClienteOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoForm}
                  className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-md shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                >
                  {guardandoForm ? 'Guardando...' : clienteEditando ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de Citas del Cliente */}
      {modalHistorialOpen && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Historial de Citas: {clienteSeleccionado.nombre}
                </h3>
                <p className="text-xs text-slate-400">
                  Teléfono: {clienteSeleccionado.numero || 'Sin número registrado'}
                </p>
              </div>
              <button
                onClick={() => setModalHistorialOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingHistorial ? (
                <div className="py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-brand-primary border-t-transparent"></div>
                  <p className="text-xs text-slate-400 mt-2">Buscando citas vinculadas...</p>
                </div>
              ) : citasHistorial.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Sin citas registradas</p>
                  <p className="text-xs mt-1">Este cliente no registra reservas pasadas o futuras aún.</p>
                </div>
              ) : (
                citasHistorial.map((cita) => (
                  <div
                    key={cita.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {cita.servicios?.nombre || 'Servicio Agendado'}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} /> {cita.fecha_inicio}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> {cita.hora_inicio}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        cita.estado === 'COMPLETADA'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : cita.estado === 'CANCELADA'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {cita.estado}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Redactar WhatsApp */}
      {modalWaOpen && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <MessageSquare size={18} />
                <span>Enviar WhatsApp a {clienteSeleccionado.nombre}</span>
              </div>
              <button
                onClick={() => setModalWaOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mensaje a enviar:
              </label>
              <textarea
                rows={4}
                value={mensajeWa}
                onChange={(e) => setMensajeWa(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalWaOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviarWhatsAppDirecto}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
              >
                <Send size={14} />
                <span>Abrir WhatsApp Web/App</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
