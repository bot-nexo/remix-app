import { supabase } from '../lib/supabase'; // Asegúrate de ajustar la ruta a tu cliente de Supabase

export type EmpresaConfig = {
  id: string;
  user_id: string;
  nombre: string;
  direccion: string;
  horario: string | null;
  politicas: string | null;
  color_primario: string;
  color_secundario: string;
  logo_url: string | null;
  nom_bot: string | null;
};

export async function obtenerEmpresaConfig(): Promise<EmpresaConfig | null> {
  const { data, error } = await supabase
    .from('empresa') // Cambia 'empresa' por el nombre exacto de tu tabla si es diferente
    .select('id, user_id, nombre, direccion, horario, politicas, nom_bot, color_primario, color_secundario, logo_url')
    .single();

  if (error) {
    console.error('Error al cargar la información de la empresa:', error);
    return null;
  }

  return data as EmpresaConfig;
}

export async function obtenerTelefonoProfesional(userId?: string): Promise<string> {
  try {
    let query = supabase.from('configuracion').select('valor').eq('clave', 'telefono_profesional');
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query.limit(1).maybeSingle();
    return data?.valor || '';
  } catch (err) {
    console.error('Error al obtener teléfono profesional:', err);
    return '';
  }
}
