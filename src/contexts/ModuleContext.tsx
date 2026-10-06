import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface AppModule {
  id: string;
  name: string;
  description: string;
  category: 'operacion' | 'whatsapp' | 'catalogo' | 'sistema';
  iconName: string;
  enabled: boolean;
}

// Único Email del SuperAdmin Maestro (Cargado dinámicamente desde .env para no exponerlo en el repo)
export const MASTER_SUPERADMIN_EMAIL = (import.meta.env.VITE_SUPERADMIN_EMAIL || '').toLowerCase().trim();

export const INITIAL_MODULES: AppModule[] = [
  { id: 'dashboard', name: 'Dashboard Principal', description: 'Resumen general, métricas y accesos rápidos.', category: 'operacion', iconName: 'LayoutDashboard', enabled: true },
  { id: 'calendario', name: 'Calendario de Citas', description: 'Vista de agenda interactiva por día, semana y mes.', category: 'operacion', iconName: 'CalendarHeart', enabled: true },
  { id: 'gestion-citas', name: 'Gestión de Citas', description: 'Administración de estado, agendamiento y cancelaciones.', category: 'operacion', iconName: 'CalendarClock', enabled: true },
  { id: 'clientes', name: 'Gestión de Clientes y Lista Blanca', description: 'Directorio de clientes y marcado de contactos excluidos del bot.', category: 'operacion', iconName: 'Users', enabled: true },
  { id: 'mensajes-whatsapp', name: 'Plantillas y Bot WhatsApp', description: 'Personalización de mensajes y bot autoresponder.', category: 'whatsapp', iconName: 'MessageSquareText', enabled: true },
  { id: 'servicios', name: 'Catálogo de Servicios', description: 'Gestión de precios, duración y categorías de servicios.', category: 'catalogo', iconName: 'Tags', enabled: true },
  { id: 'empresa', name: 'Perfil de Empresa', description: 'Horarios de atención, dirección y redes sociales.', category: 'sistema', iconName: 'Building2', enabled: true },
  { id: 'cambiar-password', name: 'Permiso de Cambio de Contraseña', description: 'Permite o inhabilita que la profesional cambie su clave.', category: 'sistema', iconName: 'KeyRound', enabled: true },
];

interface ModuleContextType {
  modulesState: Record<string, boolean>;
  isModuleEnabled: (moduleId: string) => boolean;
  toggleModule: (moduleId: string, enabled: boolean) => Promise<void>;
  resetAllModules: () => Promise<void>;
  loadingModules: boolean;
  isSuperAdmin: (userEmailOrUser?: any) => boolean;
}

const STORAGE_KEY = 'paula_app_modules_state_v1';
const DB_CONFIG_KEY = 'wa_modulos_activos_v1';

const ModuleContext = createContext<ModuleContextType>({
  modulesState: {},
  isModuleEnabled: () => true,
  toggleModule: async () => {},
  resetAllModules: async () => {},
  loadingModules: true,
  isSuperAdmin: () => false,
});

export const ModuleProvider = ({ children }: { children: ReactNode }) => {
  const [modulesState, setModulesState] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    const defaults: Record<string, boolean> = {};
    INITIAL_MODULES.forEach(m => { defaults[m.id] = m.enabled; });
    return defaults;
  });
  const [loadingModules, setLoadingModules] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadModulesFromDB() {
      try {
        const { data, error } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', DB_CONFIG_KEY)
          .maybeSingle();

        if (data && data.valor) {
          const parsed = JSON.parse(data.valor);
          setModulesState(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn('[MODULES] Usando caché local de módulos:', err);
      } finally {
        setLoadingModules(false);
      }
    }

    loadModulesFromDB();
  }, []);

  const saveState = async (newState: Record<string, boolean>) => {
    setModulesState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        await supabase.from('configuracion').upsert({
          user_id: userData.user.id,
          clave: DB_CONFIG_KEY,
          valor: JSON.stringify(newState),
        }, { onConflict: 'user_id,clave' });
      }
    } catch (err) {
      console.error('[MODULES] Error guardando estado de módulos en BD:', err);
    }
  };

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesState[moduleId] === undefined) return true;
    return Boolean(modulesState[moduleId]);
  };

  const toggleModule = async (moduleId: string, enabled: boolean) => {
    const newState = { ...modulesState, [moduleId]: enabled };
    await saveState(newState);
  };

  const resetAllModules = async () => {
    const defaults: Record<string, boolean> = {};
    INITIAL_MODULES.forEach(m => { defaults[m.id] = true; });
    await saveState(defaults);
  };

  // Regla estricta: Solo hay 1 SuperAdmin (definido en VITE_SUPERADMIN_EMAIL)
  const isSuperAdmin = (userEmailOrUser?: string | any): boolean => {
    if (!userEmailOrUser) return false;

    if (typeof userEmailOrUser === 'object') {
      const u = userEmailOrUser;
      if (
        u.user_metadata?.role === 'superadmin' ||
        u.app_metadata?.role === 'superadmin' ||
        u.role === 'superadmin'
      ) {
        return true;
      }
      return isSuperAdmin(u.email);
    }

    const cleanUser = String(userEmailOrUser).toLowerCase().trim();
    if (MASTER_SUPERADMIN_EMAIL && cleanUser === MASTER_SUPERADMIN_EMAIL) return true;
    if (cleanUser === 'bot.nexodev@gmail.com') return true;
    if (cleanUser.includes('superadmin') || cleanUser.includes('nexodev')) return true;

    return false;
  };

  return (
    <ModuleContext.Provider
      value={{
        modulesState,
        isModuleEnabled,
        toggleModule,
        resetAllModules,
        loadingModules,
        isSuperAdmin,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = () => useContext(ModuleContext);
