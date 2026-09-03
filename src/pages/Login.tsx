import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { showToast } = useToast();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);

  useEffect(() => {
    traerInfoEmpresa();
  }, []);

  const traerInfoEmpresa = async () => {
    try {
      const { data: empresa } = await supabase
        .from("empresa")
        .select("nombre, logo_url, color_primario, color_secundario")
        .limit(1)
        .maybeSingle();
      if (!empresa) {
        showToast('No se encontró información de la empresa', 'error');
        return;
      }
      localStorage.setItem('empresa', JSON.stringify(empresa));
      setEmpresa(empresa);
    } catch (error) {
      showToast('Error al cargar información de la empresa', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      }
    } catch (error) {
      showToast('Error al iniciar sesión', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorPrimario = empresa?.color_primario || '#1083b9';
  const colorSecundario = empresa?.color_secundario || '#056196';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-[#020617] dark:via-[#0a0f1e] dark:to-[#020617] flex flex-col items-center justify-center px-4 py-12 transition-colors duration-300">
      {/* Branding */}
      <div className="mb-8 text-center">
        {empresa?.logo_url ? (
          <img
            src={empresa.logo_url}
            alt={empresa.nombre}
            className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-xl ring-4 ring-white/10 dark:ring-white/5"
          />
        ) : (
          <div
            className="mx-auto mb-4 h-20 w-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl"
            style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
          >
            {empresa?.nombre?.charAt(0) || 'A'}
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {empresa?.nombre || 'Panel Admin'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestiona tu negocio desde aquí
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/60 dark:border-slate-800/60 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Iniciar Sesión</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-200 dark:border-red-900/30 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all text-sm"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: colorPrimario }}
            >
              <LogIn size={16} />
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-6">
          © {new Date().getFullYear()} {empresa?.nombre || 'Tu negocio'}. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
