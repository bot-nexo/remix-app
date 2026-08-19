import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  ShieldAlert,
  Tags,
  Building2,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Calendar
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const { isDarkMode, toggleTheme, companyName, logoUrl } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Lista Blanca', href: '/lista-blanca', icon: ShieldAlert },
    { name: 'Servicios', href: '/servicios', icon: Tags },
    { name: 'Mi Empresa', href: '/empresa', icon: Building2 },
    { name: 'Configuración', href: '/config', icon: Settings },
    { name: 'Calendario', href: '/calendario', icon: Calendar },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] z-20 sticky top-0">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(255,42,133,0.4)]">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{companyName}</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600 dark:text-slate-400">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        {/* Profile Header */}
        <div className="p-6 flex flex-col items-center justify-center border-b border-slate-200 dark:border-slate-800 hidden md:flex">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-full object-cover border-2 border-brand-primary shadow-[0_0_15px_rgba(255,42,133,0.4)] mb-4" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-3xl shadow-[0_0_15px_rgba(255,42,133,0.4)] mb-4">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center truncate w-full">{companyName}</h2>
          <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mt-1">Panel Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeMobileMenu}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200 group
                  ${isActive
                    ? 'bg-brand-primary/10 text-brand-primary font-medium dark:border dark:border-brand-primary/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <item.icon size={20} className={isActive ? 'text-brand-primary' : 'text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors'} />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
          <button
            onClick={() => {
              signOut();
              closeMobileMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto h-[calc(100vh-65px)] md:h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-0 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </div>
  );
}
