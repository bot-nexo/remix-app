import { supabase } from '../lib/supabase';

const USER_ID = import.meta.env.VITE_NEGOCIO_USER_ID;

export async function obtenerServicios() {
  if (!USER_ID) {
    throw new Error('Falta VITE_NEGOCIO_USER_ID en las variables de entorno.');
  }

  const { data, error } = await supabase
    .from('servicios')
    .select('*')
    .eq('user_id', USER_ID)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo servicios:', error);
    throw error;
  }

  return data ?? [];
};

export async function obtenerServiciosActivos() {
  if (!USER_ID) {
    throw new Error('Falta VITE_NEGOCIO_USER_ID en las variables de entorno.');
  }

  const { data, error } = await supabase
    .from('servicios')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo servicios activos:', error);
    throw error;
  }

  return data ?? [];
}