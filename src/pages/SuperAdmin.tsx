import React, { useState } from 'react';
import {
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  RefreshCcw,
  Sliders,
  Lock,
  MessageSquareText,
  LayoutDashboard,
  CalendarHeart,
  Users,
  CalendarClock,
  ShieldAlert,
  Tags,
  Building2,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useModules, INITIAL_MODULES } from '../contexts/ModuleContext';
import { supabase } from '../lib/supabase';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  CalendarHeart,
  CalendarClock,
  Users,
  MessageSquareText,
  ShieldAlert,
  Tags,
  Building2,
  KeyRound,
};

export default function SuperAdmin() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { modulesState, toggleModule, resetAllModules, isSuperAdmin } = useModules();

  // Regla estricta: Solo 1 SuperAdmin
  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />;
  }

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Handle Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'error');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(`Error al cambiar la contraseña: ${error.message}`, 'error');
      } else {
        showToast('¡Contraseña actualizada con éxito!', 'success');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      showToast(`Error de conexión: ${err?.message || 'No se pudo actualizar'}`, 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleToggleModule = async (id: string, currentEnabled: boolean) => {
    try {
      await toggleModule(id, !currentEnabled);
      showToast(
        `Módulo "${INITIAL_MODULES.find(m => m.id === id)?.name}" ${!currentEnabled ? 'activado' : 'inactivado'}.`,
        'success'
      );
    } catch (err) {
      showToast('Error al cambiar el estado del módulo.', 'error');
    }
  };

  const activeCount = INITIAL_MODULES.filter(m => modulesState[m.id] !== false).length;

  return (
    <div className="space-y-8 pb-16">
      {/* SuperAdmin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-7 rounded-3xl shadow-xl border border-indigo-900/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-widest">
            <ShieldCheck size={18} className="text-indigo-400" /> Control Maestro SuperAdmin
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            Panel de Administración Global
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Gestiona la disponibilidad de módulos del sistema y la seguridad de acceso a la plataforma.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Módulos Activos</span>
              <span className="text-sm font-bold text-white">{activeCount} / {INITIAL_MODULES.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Module Management Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Activación de Módulos de la Aplicación
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enciende o apaga las secciones del sistema en tiempo real.
                </p>
              </div>

              <button
                onClick={() => resetAllModules()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2 rounded-xl transition-colors"
              >
                <RefreshCcw size={14} />
                <span>Activar Todos</span>
              </button>
            </div>

            {/* List of Modules */}
            <div className="space-y-3">
              {INITIAL_MODULES.map((mod) => {
                const IconComp = ICON_MAP[mod.iconName] || Sliders;
                const isEnabled = modulesState[mod.id] !== false;

                return (
                  <div
                    key={mod.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isEnabled
                        ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl ${
                        isEnabled
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-200/60 dark:bg-slate-800 text-slate-400'
                      }`}>
                        <IconComp size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {mod.name}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {isEnabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleModule(mod.id, isEnabled)}
                      className="p-1 focus:outline-none transition-all transform active:scale-95"
                      title={isEnabled ? 'Inactivar módulo' : 'Activar módulo'}
                    >
                      {isEnabled ? (
                        <ToggleRight className="w-10 h-10 text-emerald-500 hover:text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-700 hover:text-slate-400" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Change Password & System Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Change Password Form */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound size={20} className="text-indigo-600 dark:text-indigo-400" />
                Seguridad y Contraseña Admin
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cambia la contraseña de acceso al panel principal.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock size={16} />
                <span>{updatingPassword ? 'Actualizando Contraseña...' : 'Actualizar Contraseña'}</span>
              </button>
            </form>
          </div>

          {/* User Account Info */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Server size={14} /> Información de Sesión
            </h3>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Usuario Autenticado:</span>
                <span className="font-bold text-slate-900 dark:text-white">{user?.email || 'Admin'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Rol de Sistema:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  SuperAdmin
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
