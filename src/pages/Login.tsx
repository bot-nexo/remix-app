import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Login() {
  const { showToast } = useToast();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);

  //********************* */
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
     console.log(empresa);
     if (!empresa) {
       showToast('No se encontró información de la empresa', 'error');
       setIsSubmitting(false);
       return;
     }
     localStorage.setItem('empresa', JSON.stringify(empresa));
     setEmpresa(empresa);
   } catch (error) {
    showToast('Error al cargar información de la empresa', 'error');
    
   }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
try {
      e.preventDefault();
      setIsSubmitting(true);
      setError(null);
  
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (error) {
        setError(error.message);
        setIsSubmitting(false);
      }
} catch (error) {
  showToast('Error al iniciar sesión', 'error');
  setIsSubmitting(false);
}
  };

  const style = `
  :root {
    --brand-primary: ${empresa?.color_primario};
    --brand-secondary: ${empresa?.color_secundario};
  }
  `;
  //***************************** */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <style>{style}</style>
        <div className={`mx-auto h-16 w-16 bg-brand-primary rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/20`}>
          <Bot className="text-white h-8 w-8" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-800 dark:text-white">
          Panel de Administración
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
          Inicia sesión para acceder a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#0f172a] py-8 px-4 shadow-xl border border-slate-200 dark:border-slate-800 sm:rounded-2xl sm:px-10 transition-colors">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-900/50">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors sm:text-sm"
                  placeholder="admin@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent 
                rounded-xl shadow-md text-sm font-medium text-white bg-brand-primary 
                hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-brand-primary dark:focus:ring-offset-slate-900 
                disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Ingresar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
