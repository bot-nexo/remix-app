import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Building2, Save, Upload, Camera } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Empresa() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { refreshCompanyData } = useTheme();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [horario, setHorario] = useState('');
  const [politicas, setPoliticas] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#0084ffff');
  const [colorSecundario, setColorSecundario] = useState('#7c7c7cff');
  const [logoUrl, setLogoUrl] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchEmpresa();
  }, [user]);

  const fetchEmpresa = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('empresa')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setEmpresaId(data.id);
      setNombre(data.nombre || '');
      setDireccion(data.direccion || '');
      setHorario(data.horario || '');
      setPoliticas(data.politicas || '');
      setColorPrimario(data.color_primario || '#0084ffff');
      setColorSecundario(data.color_secundario || '#7c7c7cff');
      setLogoUrl(data.logo_url || '');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      let currentLogoUrl = logoUrl;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('empresa')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          showToast(uploadError.message || 'Error al subir imagen', 'error');
          return;
        }

        const { data: { publicUrl } } = supabase.storage.from('empresa').getPublicUrl(fileName);
        currentLogoUrl = publicUrl;
      }

      const payload = {
        user_id: user.id, nombre, direccion, horario, politicas,
        color_primario: colorPrimario, color_secundario: colorSecundario,
        logo_url: currentLogoUrl
      };

      let error;
      if (empresaId) {
        const { error: updateError } = await supabase.from('empresa').update(payload).eq('id', empresaId);
        error = updateError;
      } else {
        const { data: createdData, error: insertError } = await supabase.from('empresa').insert(payload).select().single();
        if (createdData) setEmpresaId(createdData.id);
        error = insertError;
      }

      if (error) throw error;
      showToast('Información guardada.', 'success');
      setLogoUrl(currentLogoUrl);
      setFile(null);
      refreshCompanyData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mi Empresa</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Identidad, horarios y configuración visual de tu negocio
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Logo + Info Básica */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Información General</h2>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
                  {file ? (
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <label className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-lg">Cambiar</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Logo · JPG/PNG</p>
            </div>

            {/* Campos */}
            <div className="flex-1 space-y-3 w-full">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nombre del Negocio</label>
                <input
                  type="text" required value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Dirección</label>
                <input
                  type="text" required value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Horario de Atención</label>
                <input
                  type="text" value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  placeholder="Ej: Lunes a Sábado 9am - 7pm"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Colores */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Identidad Visual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Color Primario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color" value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
                />
                <input
                  type="text" value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                />
                <div className="w-10 h-10 rounded-xl shadow-inner" style={{ backgroundColor: colorPrimario }}></div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Color Secundario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color" value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
                />
                <input
                  type="text" value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                />
                <div className="w-10 h-10 rounded-xl shadow-inner" style={{ backgroundColor: colorSecundario }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Políticas */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Políticas del Negocio</h2>
          <p className="text-xs text-slate-400 mb-3">Reglas de reserva, cancelaciones y uso del servicio.</p>
          <textarea
            rows={4}
            value={politicas}
            onChange={(e) => setPoliticas(e.target.value)}
            placeholder="Ej: Cancelaciones con 24h de anticipación..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all resize-y"
          />
          <p className="text-[11px] text-brand-primary mt-2">
            💡 Separa cada norma con punto y coma <strong>( ; )</strong>, precios sin puntos ni comas <strong>(ej: $4000)</strong>.
          </p>
        </div>

        {/* Guardar */}
        <div className="flex justify-end">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-primary/15 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
