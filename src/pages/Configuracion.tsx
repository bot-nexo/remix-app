import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Bot, Save, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: number;
  tipo: 'success' | 'error' | 'warning';
  mensaje: string;
}

export default function Configuracion() {
  const { user } = useAuth();
  const [botActive, setBotActive] = useState(false);
  const [tolerancia, setTolerancia] = useState('15');
  const [instrucciones, setInstrucciones] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [toasts, setToasts] = useState<Toast[]>([]);

  //*************************************** */

  // Sistema de Notificaciones Toast
  const showToast = (mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (!user) return;
    fetchConfig();
  }, [user]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('user_id', user!.id);

    if (data) {
      data.forEach((item) => {
        if (item.clave === 'bot_activo') setBotActive(item.valor === 'true');
        if (item.clave === 'bot_tolerancia') setTolerancia(item.valor);
        if (item.clave === 'bot_instrucciones') setInstrucciones(item.valor);
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });

    const configs = [
      { user_id: user.id, clave: 'bot_activo', valor: botActive.toString() },
      { user_id: user.id, clave: 'bot_tolerancia', valor: tolerancia },
      { user_id: user.id, clave: 'bot_instrucciones', valor: instrucciones }
    ];

    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert(configs, { onConflict: 'user_id, clave' });

      if (error) throw error;
      showToast('Configuración guardada correctamente.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500">Cargando datos...</div>;

  //*************************************** */
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Container de Toasts */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${t.tipo === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : t.tipo === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              }`}
          >
            {t.tipo === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
            {t.tipo === 'error' && <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
            {t.tipo === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {t.mensaje}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-brand-primary" />
          Configuración del Bot
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Ajusta el comportamiento general y las instrucciones directas para tu asistente virtual de WhatsApp
        </p>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-8">

          {message.text && (
            <div className={`p-4 rounded-xl text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400'}`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${botActive ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                <Bot size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Estado del Asistente Virtual</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{botActive ? 'El bot está activo y respondiendo mensajes' : 'El bot está pausado'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={botActive}
                onChange={(e) => setBotActive(e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 dark:peer-focus:ring-brand-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tiempo de tolerancia para citas (minutos)
            </label>
            <input
              type="number"
              min="0"
              required
              value={tolerancia}
              onChange={(e) => setTolerancia(e.target.value)}
              className="w-full md:w-1/3 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-2">Tiempo máximo que esperará el cliente antes de cancelar la cita por retraso.</p>
          </div> */}

          {/* <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Indicaciones Especiales para la IA
            </label>
            <textarea
              rows={6}
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              placeholder="Ej: Recuerda mencionar que hoy tenemos promoción 2x1 en cortes de barba..."
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">Instrucciones que el bot utilizará como contexto al conversar con los clientes.</p>
          </div> */}

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-medium transition-all shadow-sm shadow-brand-primary/20 disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
