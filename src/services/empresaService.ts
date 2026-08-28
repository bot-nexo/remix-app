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
    .select('*')
    .single();

  if (error) {
    console.error('Error al cargar la información de la empresa:', error);
    return null;
  }

  return data as EmpresaConfig;
}