import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Servicio } from '../types/types';
import ConfirmModal from '../components/ConfirmModal';
import {
  Tags,
  Trash2,
  Plus,
  Edit3,
  Power,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export default function Servicios() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const [nombre, setNombre] = useState('');
  const [valor, setValor] = useState('');
  const [duracion, setDuracion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 6;

  useEffect(() => {
    if (!user) return;
    fetchServicios();
  }, [user]);

  const fetchServicios = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('servicios')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (data) setServicios(data.map(s => ({ ...s, activo: s.activo ?? true })));
    } catch (error) {
      showToast('Error al cargar servicios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNombre('');
    setValor('');
    setDuracion('');
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      if (!user || !nombre.trim() || !valor || !duracion) {
        showToast('Todos los campos son obligatorios', 'error');
        return;
      }

      const nombreLimpio = nombre.trim();
      const esDuplicado = servicios.some(
        (s) => s.nombre.toLowerCase() === nombreLimpio.toLowerCase() && s.id !== editingId
      );
      if (esDuplicado) {
        showToast(`El servicio "${nombreLimpio}" ya existe.`, 'warning');
        return;
      }

      setSubmitting(true);

      if (editingId) {
        const { error } = await supabase
          .from('servicios')
          .update({ nombre: nombreLimpio, valor: parseFloat(valor), duracion_minutos: parseInt(duracion, 10) })
          .eq('id', editingId);
        if (!error) {
          showToast('Servicio actualizado.', 'success');
          resetForm();
          fetchServicios();
        } else {
          showToast(error.message, 'error');
        }
      } else {
        const { error } = await supabase
          .from('servicios')
          .insert({ user_id: user.id, nombre: nombreLimpio, valor: parseFloat(valor), duracion_minutos: parseInt(duracion, 10), activo: true });
        if (!error) {
          showToast('Servicio creado.', 'success');
          resetForm();
          fetchServicios();
        } else {
          showToast(error.message, 'error');
        }
      }
    } catch (error) {
      showToast('Error al guardar servicio', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (servicio: Servicio) => {
    setEditingId(servicio.id);
    setNombre(servicio.nombre);
    setValor(servicio.valor.toString());
    setDuracion(servicio.duracion_minutos.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleActivo = async (servicio: Servicio) => {
    try {
      setLoading(true);
      const nuevoEstado = !servicio.activo;
      setServicios((prev) => prev.map((s) => (s.id === servicio.id ? { ...s, activo: nuevoEstado } : s)));
      const { error } = await supabase.from('servicios').update({ activo: nuevoEstado }).eq('id', servicio.id);
      if (error) {
        showToast('Error al actualizar estado.', 'error');
        fetchServicios();
      } else {
        showToast(`Servicio ${nuevoEstado ? 'activado' : 'desactivado'}.`, 'success');
      }
    } catch (error) {
      showToast('Error al actualizar estado', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      if (!user || !deletingId) { showToast('Error al eliminar.', 'error'); return; }
      setIsDeleting(true);
      const id = deletingId;
      const { error } = await supabase.from('servicios').delete().eq('id', id).eq('user_id', user.id);
      if (!error) {
        setServicios((prev) => prev.filter((s) => s.id !== id));
        showToast('Servicio eliminado.', 'success');
        if (editingId === id) resetForm();
      } else {
        showToast('No se puede eliminar: existen citas asociadas.', 'error');
      }
    } catch (error) {
      showToast('Error al eliminar', 'error');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const totalPaginas = Math.ceil(servicios.length / elementosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * elementosPorPagina;
  const serviciosPaginados = useMemo(() => {
    return servicios.slice(indiceInicio, indiceInicio + elementosPorPagina);
  }, [servicios, paginaActual, elementosPorPagina]);

  const formatCurrency = (v: number) => `$${Number(v).toLocaleString('es-CO')}`;

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Servicios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Administra precios, duraciones y disponibilidad
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {editingId ? '✏️ Editar servicio' : '➕ Nuevo servicio'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors">
              <X size={12} /> Cancelar
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nombre</label>
            <input
              type="text" required value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Manicure"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Precio ($)</label>
            <input
              type="number" required min="0" step="0.01" value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="25000"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Duración (min)</label>
            <input
              type="number" required min="1" value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              placeholder="30"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
            />
          </div>
          <button
            type="submit" disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-brand-primary/15"
          >
            {editingId ? <Edit3 size={14} /> : <Plus size={16} />}
            {submitting ? '...' : editingId ? 'Actualizar' : 'Guardar'}
          </button>
        </form>
      </div>

      {/* Lista de Servicios */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Cargando servicios...</div>
        ) : servicios.length === 0 ? (
          <div className="p-12 text-center">
            <Tags className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay servicios registrados</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crea tu primer servicio arriba</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/60">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Duración</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                  {serviciosPaginados.map((servicio) => (
                    <tr key={servicio.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{servicio.nombre}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {formatCurrency(servicio.valor)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                        {servicio.duracion_minutos} min
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleActivo(servicio)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${servicio.activo
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                        >
                          <Power className="w-3 h-3" />
                          {servicio.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(servicio)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingId(servicio.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400">
                <p>{servicios.length} servicios en total</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                    disabled={paginaActual === 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-medium text-slate-600 dark:text-slate-300">{paginaActual}/{totalPaginas}</span>
                  <button
                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Eliminar Servicio"
        message="¿Eliminar este servicio? No se podrá deshacer y fallará si existen citas asociadas."
        confirmText="Eliminar"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
