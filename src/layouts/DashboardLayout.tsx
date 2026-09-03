import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Tags,
  Building2,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  CalendarClock,
  CalendarHeart
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
    { name: 'Calendario', href: '/calendario', icon: CalendarHeart },
    { name: 'Gestión de Citas', href: '/gestion-citas', icon: CalendarClock },
    { name: 'Servicios', href: '/servicios', icon: Tags },
    { name: 'Empresa', href: '/empresa', icon: Building2 },
    { name: 'Configuración', href: '/config', icon: Settings },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  //*************************
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] z-40 sticky top-0 backdrop-blur-xl bg-white/80 dark:bg-[#0f172a]/80">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold text-sm">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-sm block leading-tight">{companyName}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Panel Admin</span>
          </div>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 flex flex-col
        bg-white dark:bg-[#0f172a] border-r border-slate-200/80 dark:border-slate-800/60
        transform transition-transform duration-300 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Profile Header */}
        <div className="px-6 pt-8 pb-6 flex flex-col items-center border-b border-slate-100 dark:border-slate-800/60 hidden md:flex">
          <div className="relative mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover shadow-lg ring-2 ring-white dark:ring-slate-800" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {companyName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white dark:border-[#0f172a]"></div>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white text-center truncate w-full">{companyName}</h2>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mt-1">Administración</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeMobileMenu}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors'} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800/60 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
          <button
            onClick={() => {
              signOut();
              closeMobileMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto h-[calc(100vh-61px)] md:h-screen">
        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </div>
  );
}
