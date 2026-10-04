import { Camera, Check, Droplets, Save, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ANGEL_PALETTE_STORAGE_KEY, ANGEL_PALETTES, findAngelPalette } from '../constants/angelPalettes';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export default function Empresa() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { refreshCompanyData } = useTheme();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [nomBot, setNomBot] = useState('Mia');
  const [direccion, setDireccion] = useState('');
  const [horario, setHorario] = useState('');
  const [politicas, setPoliticas] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#C96F8D');
  const [colorSecundario, setColorSecundario] = useState('#7B3F54');
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
      setNomBot(data.nom_bot || 'Mia');
      setDireccion(data.direccion || '');
      setHorario(data.horario || '');
      setPoliticas(data.politicas || '');
      const palette = findAngelPalette(data.color_primario, data.color_secundario);
      setColorPrimario(palette.primary);
      setColorSecundario(palette.secondary);
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
        user_id: user.id, nombre, nom_bot: nomBot, direccion, horario, politicas,
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
      localStorage.setItem(ANGEL_PALETTE_STORAGE_KEY, JSON.stringify({ primary: colorPrimario, secondary: colorSecundario }));
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

  const aplicarPaleta = (primary: string, secondary: string) => {
    setColorPrimario(primary);
    setColorSecundario(secondary);
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
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nombre de la Asistente Virtual (Bot WhatsApp)</label>
                <input
                  type="text" value={nomBot}
                  onChange={(e) => setNomBot(e.target.value)}
                  placeholder="Ej: Mia, Paula, Sofía..."
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
        <div className="relative overflow-hidden rounded-2xl border border-[#efc5d3]/30 bg-[linear-gradient(135deg,#fff7f8_0%,#fff_52%,#f8e8ed_100%)] p-5 dark:border-[#efc5d3]/15 dark:bg-[linear-gradient(135deg,#20131a_0%,#0f172a_58%,#2b1823_100%)]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full border border-[#c96f8d]/15" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-brand-primary">
                  <Sparkles size={15} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Firma Angel Nails</p>
                </div>
                <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">Elige tu atmósfera</h2>
                <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-500 dark:text-slate-400">Estos colores aparecerán en tu panel y en la experiencia de reservas de tus clientes.</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#c96f8d]/10 text-[#c96f8d]"><Droplets size={18} /></div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {ANGEL_PALETTES.map((palette) => {
                const selected = colorPrimario.toUpperCase() === palette.primary && colorSecundario.toUpperCase() === palette.secondary;
                return (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() => aplicarPaleta(palette.primary, palette.secondary)}
                    className={`relative flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5 ${selected ? 'border-brand-primary bg-brand-primary/10 shadow-sm' : 'border-slate-200/80 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/40'}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg shadow-inner"><span className="h-full w-1/2" style={{ backgroundColor: palette.primary }} /><span className="h-full w-1/2" style={{ backgroundColor: palette.secondary }} /></span>
                    <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{palette.name}</span><span className="block text-[9px] uppercase tracking-wider text-slate-400">Paleta</span></span>
                    {selected && <Check size={14} className="ml-auto shrink-0 text-brand-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/50">
              <div className="flex items-center justify-between px-4 py-3" style={{ background: `linear-gradient(110deg, ${colorPrimario}, ${colorSecundario})` }}>
                <div className="flex items-center gap-2 text-white"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20"><Sparkles size={12} /></span><span className="text-[11px] font-semibold">Vista previa de tu marca</span></div>
                <span className="text-[10px] font-medium text-white/75">Angel Nails</span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                <span className="h-7 rounded-lg" style={{ backgroundColor: colorPrimario }} />
                <span className="h-7 rounded-lg" style={{ backgroundColor: colorSecundario }} />
                <span className="h-7 rounded-lg border border-slate-200 bg-[#f7e4e8] dark:border-slate-700" />
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

