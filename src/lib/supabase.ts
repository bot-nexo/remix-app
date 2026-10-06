import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las variables de entorno de Supabase. Configúralas para que la app funcione.');
}

// Purga de seguridad: Eliminar cualquier token antiguo de localStorage para no permitir sesiones permanentes
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // ignore
  }
}

// Configuración de Seguridad Estricta:
// Al utilizar window.sessionStorage, la sesión permanece activa durante la navegación,
// pero se destruye automáticamente el segundo en que se cierra la pestaña o la ventana del navegador.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
