import {
  Building2,
  CalendarClock,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  Tags,
  Users,
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useModules } from '../contexts/ModuleContext';
import WhatsAppHelpModal from '../components/WhatsAppHelpModal';

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const { isDarkMode, toggleTheme, companyName, logoUrl } = useTheme();
  const { isModuleEnabled, isSuperAdmin } = useModules();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

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

  const userIsSuper = isSuperAdmin(user);

  const allNavigation = [
    { id: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { id: 'calendario', name: 'Calendario', href: '/calendario', icon: CalendarHeart },
    { id: 'gestion-citas', name: 'Gestión de Citas', href: '/gestion-citas', icon: CalendarClock },
    { id: 'clientes', name: 'Clientes & Exclusiones', href: '/clientes', icon: Users },
    { id: 'informes', name: 'Informes & Reportes', href: '/informes', icon: FileText },
    { id: 'mensajes-whatsapp', name: 'Personaliz. Mensajes', href: '/mensajes-whatsapp', icon: MessageSquareText },
    { id: 'servicios', name: 'Servicios', href: '/servicios', icon: Tags },
    { id: 'empresa', name: 'Empresa', href: '/empresa', icon: Building2 },
    { id: 'configuracion', name: 'Configuración', href: '/config', icon: Settings },
    { id: 'superadmin', name: 'Control SuperAdmin', href: '/superadmin', icon: ShieldCheck },
  ];

  // Filter modules according to active status and single SuperAdmin rule
  const visibleNavigation = allNavigation.filter(item => {
    if (item.id === 'superadmin') return userIsSuper;
    if (item.id === 'configuracion' || item.id === 'informes') return true;
    return isModuleEnabled(item.id);
  });

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="admin-shell min-h-screen min-w-0 overflow-x-hidden bg-slate-50 dark:bg-[#020617] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] z-40 sticky top-0 backdrop-blur-xl bg-white/80 dark:bg-[#0f172a]/80">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
          ) : (
            <img src="/logo.svg" alt="Angel Nails" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
          )}
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-sm block leading-tight">{companyName}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Panel Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* WhatsApp Help Trigger (Mobile) */}
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs"
            title="Ayuda Bot WhatsApp"
          >
            <MessageSquareText size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px]">Ayuda Bot</span>
          </button>

          <button 
            aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col
        bg-white dark:bg-[#0f172a] border-r border-slate-200/80 dark:border-slate-800/60
        transform transition-transform duration-300 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto ${desktopNavCollapsed ? 'md:w-20' : 'md:w-72'}
      `}>
        {/* Floating Collapse Toggle Button */}
        <button
          type="button"
          aria-label={desktopNavCollapsed ? 'Expandir navegación' : 'Colapsar navegación'}
          aria-expanded={!desktopNavCollapsed}
          title={desktopNavCollapsed ? 'Expandir navegación' : 'Colapsar navegación'}
          onClick={() => setDesktopNavCollapsed((current) => !current)}
          className="hidden md:flex absolute -right-3.5 top-6 z-30 h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all hover:scale-110 hover:border-brand-primary hover:text-brand-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
        >
          {desktopNavCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        {/* Profile Header */}
        <div className={`border-b border-slate-100 dark:border-slate-800/60 hidden md:flex ${desktopNavCollapsed ? 'flex-col items-center px-2 py-5' : 'flex-col items-center px-5 pb-6 pt-7'}`}>
          <div className="relative mb-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className={`${desktopNavCollapsed ? 'w-10 h-10 rounded-xl' : 'w-16 h-16 rounded-2xl'} object-cover shadow-lg ring-2 ring-white dark:ring-slate-800 transition-all duration-200`} />
            ) : (
              <img src="/logo.svg" alt="Angel Nails" className={`${desktopNavCollapsed ? 'w-10 h-10 rounded-xl' : 'w-16 h-16 rounded-2xl'} object-cover shadow-lg ring-2 ring-white dark:ring-slate-800 transition-all duration-200`} />
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 ${desktopNavCollapsed ? 'w-3 h-3' : 'w-4 h-4'} bg-emerald-400 rounded-full border-2 border-white dark:border-[#0f172a] transition-all`}></div>
          </div>
          {!desktopNavCollapsed && <>
            <h2 className="text-base font-bold text-slate-900 dark:text-white text-center truncate w-full">{companyName}</h2>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-[0.18em] uppercase mt-1">Centro de control</span>
          </>}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-5 space-y-1 overflow-y-auto ${desktopNavCollapsed ? 'px-2' : 'px-3'}`}>
          {!desktopNavCollapsed && <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-600">Operación</p>}
          {visibleNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            const isSuper = item.id === 'superadmin';
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeMobileMenu}
                title={desktopNavCollapsed ? item.name : undefined}
                className={`
                  group flex items-center rounded-xl py-3 text-sm font-medium transition-all duration-200
                  ${desktopNavCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}
                  ${isActive
                    ? isSuper ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                    : isSuper
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <item.icon size={18} className={isActive ? 'text-white' : isSuper ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors'} />
                <span className={desktopNavCollapsed ? 'sr-only' : undefined}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`${desktopNavCollapsed ? 'mx-2' : 'mx-3'} mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800/60 dark:bg-slate-950/40`}>
          <div className={`mb-2 flex items-center rounded-xl bg-white py-2.5 dark:bg-slate-900 ${desktopNavCollapsed ? 'justify-center' : 'gap-2 px-3'}`} title={desktopNavCollapsed ? 'Agenda operativa activa' : undefined}>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]" />
            {!desktopNavCollapsed && <>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Agenda operativa</span>
              <span className="ml-auto text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Activa</span>
            </>}
          </div>
          <button
            title={desktopNavCollapsed ? (isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro') : undefined}
            onClick={toggleTheme}
            className={`w-full flex items-center rounded-xl py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white ${desktopNavCollapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className={desktopNavCollapsed ? 'sr-only' : undefined}>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
          <button
            title={desktopNavCollapsed ? 'Cerrar sesión' : undefined}
            onClick={() => {
              signOut();
              closeMobileMenu();
            }}
            className={`w-full flex items-center rounded-xl py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 ${desktopNavCollapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}
          >
            <LogOut size={18} />
            <span className={desktopNavCollapsed ? 'sr-only' : undefined}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative h-[calc(100vh-61px)] min-w-0 flex-1 overflow-x-hidden overflow-y-auto md:h-screen">
        <div className="admin-content mx-auto max-w-7xl min-w-0 p-4 sm:p-5 md:p-8">
          <div className="mb-7 hidden items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-800/70 md:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary">Panel administrativo</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gestiona tu agenda con calma y claridad.</p>
            </div>

            <div className="flex items-center gap-3">
              {/* WhatsApp Help Trigger (Desktop) */}
              <button
                type="button"
                onClick={() => setHelpModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs"
                title="Ayuda Bot WhatsApp y Comandos"
              >
                <MessageSquareText size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>Ayuda Bot WA</span>
              </button>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sistema activo
              </div>
            </div>
          </div>

          <Outlet />
        </div>
      </main>

      {/* WhatsApp Help Modal */}
      <WhatsAppHelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

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
