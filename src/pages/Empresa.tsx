import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Building2, Save, Upload } from 'lucide-react';
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

  //************************************* */
  useEffect(() => {
    if (!user) return;
    fetchEmpresa();
  }, [user]);

  const fetchEmpresa = async () => {
    setLoading(true);
    // Usamos .maybeSingle() para que no lance error si la empresa aún no existe
    const { data, error } = await supabase
      .from('empresa')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching empresa:', error);
      showToast(error.message || 'Error al cargar empresa', 'error');
    }

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

      // Subida de imagen
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('empresa')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error('Error al subir imagen:', uploadError);
          showToast(uploadError.message || 'Error al subir imagen', 'error');
          return;
        }


        const { data: { publicUrl } } = supabase.storage
          .from('empresa')
          .getPublicUrl(fileName);

        currentLogoUrl = publicUrl;
      }

      const payload = {
        user_id: user.id,
        nombre,
        direccion,
        horario,
        politicas,
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        logo_url: currentLogoUrl
      };

      let error;

      if (empresaId) {
        // UPDATE si ya existe el registro
        const { error: updateError } = await supabase
          .from('empresa')
          .update(payload)
          .eq('id', empresaId);
        error = updateError;
      } else {
        // INSERT si es la primera vez y capturamos el id generado
        const { data: createdData, error: insertError } = await supabase
          .from('empresa')
          .insert(payload)
          .select()
          .single();

        if (createdData) {
          setEmpresaId(createdData.id);
        }
        error = insertError;
      }

      if (error) throw error;

      showToast('Configuración de empresa guardada exitosamente', 'success');
      setLogoUrl(currentLogoUrl);
      setFile(null);
      refreshCompanyData();

    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar configuración de empresa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  if (loading) return <div className="text-slate-500">Cargando datos...</div>;

  //************************************* */
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Building2 className="w-8 h-8 text-brand-primary" />
          Mi Empresa
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Personaliza la identidad, horarios y parámetros visuales de tu negocio
        </p>
      </div>

      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-1/3 flex flex-col items-center gap-4">
              <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden group flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400" />
                )}
                <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
                  <span className="text-white text-xs font-medium">Cambiar</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Logo de la Empresa</p>
                <p className="text-xs text-slate-500 mt-1">JPG / PNG.</p>
              </div>
            </div>

            <div className="w-full md:w-2/3 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Negocio</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Horario de Atención</label>
              <textarea
                rows={1}
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                placeholder="Ej: Lunes a Sábado 9am - 7pm"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color Primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="h-10 w-10 p-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 
            mb-1">Políticas del Establecimiento <span className="text-xs text-slate-500 dark:text-slate-400">(Reglas de reserva, cancelaciones y uso del servicio.)</span></label>
            <textarea
              rows={5}
              value={politicas}
              onChange={(e) => setPoliticas(e.target.value)}
              placeholder="Ej: Cancelaciones con 24h de anticipación..."
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 
              rounded-xl bg-transparent dark:text-white focus:ring-2 
              focus:ring-brand-primary focus:border-transparent outline-none transition-all 
              resize-y"
            />
            <p className="text-xs text-brand-primary dark:text-brand-primary">
              💡 <strong>Importante:</strong> Separa cada norma con  punto y coma <strong>( ; )</strong>, y escribe precios sin puntos ni comas<strong> (ej: $4000)</strong>.
            </p>
          </div>

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