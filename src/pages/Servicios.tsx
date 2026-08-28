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
  ChevronRight
} from 'lucide-react';

export default function Servicios() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [servicios, setServicios] = useState<Servicio[]>([]);

  // Campos formulario
  const [nombre, setNombre] = useState('');
  const [valor, setValor] = useState('');
  const [duracion, setDuracion] = useState('');

  // Estado para Edición
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados UI y Modales
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 5;

  //******************************** */
  useEffect(() => {
    if (!user) return;
    fetchServicios();
  }, [user]);

  const fetchServicios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('servicios')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setServicios(data.map(s => ({ ...s, activo: s.activo ?? true })));
      }
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

  // Guardar o Editar Servicio
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
        showToast(`El servicio "${nombreLimpio}" ya se encuentra registrado.`, 'warning');
        return;
      }

      setSubmitting(true);

      if (editingId) {
        const { error } = await supabase
          .from('servicios')
          .update({
            nombre: nombreLimpio,
            valor: parseFloat(valor),
            duracion_minutos: parseInt(duracion, 10),
          })
          .eq('id', editingId);

        if (!error) {
          showToast('Servicio actualizado correctamente.', 'success');
          resetForm();
          fetchServicios();
        } else {
          showToast(error.message, 'error');
        }
      } else {
        const { error } = await supabase
          .from('servicios')
          .insert({
            user_id: user.id,
            nombre: nombreLimpio,
            valor: parseFloat(valor),
            duracion_minutos: parseInt(duracion, 10),
            activo: true
          });

        if (!error) {
          showToast('Servicio registrado con éxito.', 'success');
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

      setServicios((prev) =>
        prev.map((s) => (s.id === servicio.id ? { ...s, activo: nuevoEstado } : s))
      );

      const { error } = await supabase
        .from('servicios')
        .update({ activo: nuevoEstado })
        .eq('id', servicio.id);

      if (error) {
        showToast('Error al actualizar el estado.', 'error');
        fetchServicios();
      } else {
        showToast(
          `Servicio ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`,
          'success');
      }
    } catch (error) {
      showToast('Error al actualizar el estado', 'error');
    }finally{
      setLoading(false);
    }
  };

  // Confirmar y Ejecutar Eliminación
  const confirmDelete = async () => {
    try {
      if (!user || !deletingId){
        showToast('Error al eliminar el servicio.', 'error');
         return};

      setIsDeleting(true);
      const id = deletingId;

      try {
        const { error } = await supabase
          .from('servicios')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (!error) {
          setServicios((prev) => prev.filter((s) => s.id !== id));
          showToast('Servicio eliminado correctamente.', 'success');
          if (editingId === id) resetForm();
        } else {
          showToast(
            'No se puede eliminar porque existen citas asociadas a este servicio.',
            'error'
          );
        }
      } catch (err) {
        showToast('Error al eliminar el servicio.', 'error');
      } finally {
        setIsDeleting(false);
        setDeletingId(null);
      }
    } catch (error) {
      showToast('Error al eliminar el servicio', 'error');
    }
  };

  // Paginación
  const totalPaginas = Math.ceil(servicios.length / elementosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * elementosPorPagina;
  const serviciosPaginados = useMemo(() => {
    return servicios.slice(indiceInicio, indiceInicio + elementosPorPagina);
  }, [servicios, paginaActual, elementosPorPagina]);

  //******************************** */
  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Tags className="w-8 h-8 text-brand-primary" />
          Gestión de Servicios
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Administra los servicios, precios, duraciones y disponibilidad para tus clientes
        </p>
      </div>

      {/* Formulario Crear / Editar */}
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {editingId ? 'Editar Servicio' : 'Agregar Nuevo Servicio'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Nails 1"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Precio ($)
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ej: 25.00"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Duración (min)
            </label>
            <input
              type="number"
              required
              min="1"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              placeholder="Ej: 30"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-medium transition-all h-[42px] disabled:opacity-50"
          >
            {editingId ? <Edit3 size={18} /> : <Plus size={20} />}
            {submitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
          </button>
        </form>
      </div>

      {/* Tabla de Servicios */}
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Nombre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Precio</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Duración</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Cargando...</td>
                </tr>
              ) : servicios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No hay servicios registrados.
                  </td>
                </tr>
              ) : (
                serviciosPaginados.map((servicio) => (
                  <tr key={servicio.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">
                      {servicio.nombre}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      ${Number(servicio.valor).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {servicio.duracion_minutos} min
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActivo(servicio)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${servicio.activo
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20'
                          }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {servicio.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleStartEdit(servicio)}
                          className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Editar"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => setDeletingId(servicio.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <p>
              Mostrando <span className="font-medium text-slate-700 dark:text-slate-200">{indiceInicio + 1}</span> a{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {Math.min(indiceInicio + elementosPorPagina, servicios.length)}
              </span>{' '}
              de <span className="font-medium text-slate-700 dark:text-slate-200">{servicios.length}</span> servicios
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="font-medium text-slate-700 dark:text-slate-200">
                {paginaActual} / {totalPaginas}
              </span>

              <button
                onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Reutilizable de Confirmación */}
      <ConfirmModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Eliminar Servicio"
        message="¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer y fallará si existen citas ligadas a él."
        confirmText="Sí, eliminar"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}