import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Bot, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Configuracion() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [botActive, setBotActive] = useState(false);
  const [tolerancia, setTolerancia] = useState('15');
  const [metaVentas, setMetaVentas] = useState('5000000');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchConfig();
  }, [user]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('user_id', user!.id);
    if (data) {
      data.forEach((item) => {
        if (item.clave === 'bot_activo') setBotActive(item.valor === 'true');
        if (item.clave === 'bot_tolerancia') setTolerancia(item.valor);
        if (item.clave === 'meta_ventas_mes') setMetaVentas(item.valor);
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const configs = [
      { user_id: user.id, clave: 'bot_activo', valor: botActive.toString() },
      { user_id: user.id, clave: 'bot_tolerancia', valor: tolerancia },
      { user_id: user.id, clave: 'meta_ventas_mes', valor: metaVentas },
    ];
    try {
      const { error } = await supabase.from('configuracion').upsert(configs, { onConflict: 'user_id, clave' });
      if (error) throw error;
      showToast('Configuracion guardada.', 'success');
    } catch (err: any) {
      showToast('Error al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configuracion</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Ajusta el comportamiento de tu asistente
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Estado del Asistente */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${botActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Asistente Virtual</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{botActive ? 'Activo y respondiendo' : 'Pausado'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={botActive} onChange={(e) => setBotActive(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-primary"></div>
            </label>
          </div>
        </div>

        {/* Tolerancia */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Tiempo de Tolerancia</h3>
          <div className="flex items-end gap-3">
            <div className="w-32">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Minutos</label>
              <input
                type="number" min="0" required value={tolerancia}
                onChange={(e) => setTolerancia(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">Tiempo que esperara al cliente antes de marcar inasistencia.</p>
          </div>
        </div>

        {/* Meta de Ventas */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Meta de Ventas del Mes</h3>
          <div className="flex items-end gap-3">
            <div className="w-48">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Monto en pesos</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number" min="0" required value={metaVentas}
                  onChange={(e) => setMetaVentas(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">Meta que deseas alcanzar este mes. El dashboard calculará el porcentaje.</p>
          </div>
        </div>

        {/* Guardar */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-primary/15 disabled:opacity-50">
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
