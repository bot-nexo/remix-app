import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Trash2, Plus } from 'lucide-react';
import { Contacto } from '../types/types';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

export default function ListaBlanca() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contactoAEliminar, setContactoAEliminar] = useState<{ id: string; nombre: string; telefono?: string } | null>(null);
  const [eliminando, setEliminando] = useState(false);

  //******************************** */
  useEffect(() => {
    if (!user) return;
    fetchContactos();
  }, [user]);

  const fetchContactos = async () => {
 try {
     setLoading(true);
     const { data, error } = await supabase
       .from('lista_blanca')
       .select('*')
       .eq('user_id', user!.id)
       .order('created_at', { ascending: false });
     
     if (data) setContactos(data);
 } catch (error) {
  showToast('Error al cargar contactos', 'error');
 }finally{
  setLoading(false);
 }
  };

  const handleAdd = async (e: React.FormEvent) => {
 try {
     e.preventDefault();
     if (!user || !nombre || !numero) return;
     setSubmitting(true);

     const { error } = await supabase
       .from('lista_blanca')
      .insert({
        user_id: user.id,
        nombre_contacto: nombre,
        numero_whatsapp: numero
      });

      if (!error) {
        // Sincronizar estado en conversacion_estado a 'HUMANO'
        const cleanPhone = numero.replace(/\D/g, '');
        try {
          await supabase.rpc('actualizar_o_crear_conversacion_estado', {
            p_cliente_id: null,
            p_telefono: cleanPhone,
            p_nuevo_estado: 'HUMANO',
          });
        } catch (rpcErr) {
          console.warn('[LISTA_BLANCA] No se pudo sincronizar conversacion_estado:', rpcErr);
        }

        setNombre('');
        setNumero('');
        fetchContactos();
      } else {
        showToast('Error al agregar contacto', 'error');
      }
      setSubmitting(false);
    } catch (error) {
      showToast('Error al agregar contacto', 'error');
    }
  };

  const handleConfirmarEliminar = async () => {
    if (!user || !contactoAEliminar) return;

    setEliminando(true);
    try {
      const { error } = await supabase
        .from('lista_blanca')
        .delete()
        .eq('id', contactoAEliminar.id)
        .eq('user_id', user.id);

      if (!error) {
        if (contactoAEliminar.telefono) {
          const cleanPhone = contactoAEliminar.telefono.replace(/\D/g, '');
          try {
            await supabase.rpc('actualizar_o_crear_conversacion_estado', {
              p_cliente_id: null,
              p_telefono: cleanPhone,
              p_nuevo_estado: 'MENU_PRINCIPAL',
            });
          } catch (rpcErr) {
            console.warn('[LISTA_BLANCA] No se pudo sincronizar conversacion_estado:', rpcErr);
          }
        }
        setContactos(contactos.filter((c) => c.id !== contactoAEliminar.id));
        showToast(`Contacto "${contactoAEliminar.nombre}" eliminado de la lista blanca.`, 'success');
        setContactoAEliminar(null);
      }
    } catch (error) {
      showToast('Error al eliminar contacto', 'error');
    } finally {
      setEliminando(false);
    }
  };

  //******************************** */
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-brand-primary" />
          Lista Blanca
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Contactos que el bot de WhatsApp ignorará automáticamente
        </p>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Agregar Contacto Excluido</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre Contacto
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Mamá"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Número WhatsApp
            </label>
            <input
              type="text"
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej: 573001234567"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-medium transition-all h-[42px] disabled:opacity-50"
          >
            <Plus size={20} />
            {submitting ? 'Guardando...' : 'Guardar en Lista Blanca'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Nombre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest">Número WhatsApp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-400 uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">Cargando...</td>
                </tr>
              ) : contactos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    No hay contactos registrados en la lista blanca.
                  </td>
                </tr>
              ) : (
                contactos.map((contacto) => (
                  <tr key={contacto.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">
                      {contacto.nombre_contacto}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {contacto.numero_whatsapp}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setContactoAEliminar({ id: contacto.id, nombre: contacto.nombre_contacto, telefono: contacto.numero_whatsapp })}
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

      <ConfirmModal
        isOpen={Boolean(contactoAEliminar)}
        onClose={() => setContactoAEliminar(null)}
        onConfirm={handleConfirmarEliminar}
        title="Eliminar de Lista Blanca"
        message={`¿Deseas remover a "${contactoAEliminar?.nombre}" de la Lista Blanca? El bot de WhatsApp volverá a responderle normalmente.`}
        confirmText="Sí, Remover"
        cancelText="Conservar"
        variant="warning"
        loading={eliminando}
      />
    </div>
  );
}
