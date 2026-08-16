import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tags, Trash2, Plus } from 'lucide-react';

interface Servicio {
  id: string;
  nombre: string;
  valor: number;
  duracion_minutos: number;
}

export default function Servicios() {
  const { user } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nombre, setNombre] = useState('');
  const [valor, setValor] = useState('');
  const [duracion, setDuracion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchServicios();
  }, [user]);

  const fetchServicios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setServicios(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nombre || !valor || !duracion) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('servicios')
      .insert({
        user_id: user.id,
        nombre: nombre,
        valor: parseFloat(valor),
        duracion_minutos: parseInt(duracion, 10)
      });

    if (!error) {
      setNombre('');
      setValor('');
      setDuracion('');
      fetchServicios();
    } else {
      alert(error.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm('¿Eliminar este servicio?')) return;

    const { error } = await supabase
      .from('servicios')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      setServicios(servicios.filter(s => s.id !== id));
    } else {
      alert("No se pudo eliminar (es posible que existan citas con este servicio).");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Tags className="w-8 h-8 text-brand-primary" />
          Gestión de Servicios
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Administra los servicios, precios y duraciones disponibles para tus clientes
        </p>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Agregar Nuevo Servicio</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Corte Clásico"
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
            <Plus size={20} />
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Nombre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Precio</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Duración</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Cargando...</td>
                </tr>
              ) : servicios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No hay servicios registrados.
                  </td>
                </tr>
              ) : (
                servicios.map((servicio) => (
                  <tr key={servicio.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">
                      {servicio.nombre}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      ${Number(servicio.valor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {servicio.duracion_minutos} min
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(servicio.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
