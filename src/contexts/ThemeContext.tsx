import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  primaryColor: string;
  secondaryColor: string;
  refreshCompanyData: () => Promise<void>;
  companyName: string;
  logoUrl: string;
}

const defaultPrimary = '#ff2a85';
const defaultSecondary = '#e11d48';

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {},
  primaryColor: defaultPrimary,
  secondaryColor: defaultSecondary,
  refreshCompanyData: async () => {},
  companyName: 'Mi Agenda',
  logoUrl: '',
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [primaryColor, setPrimaryColor] = useState(defaultPrimary);
  const [secondaryColor, setSecondaryColor] = useState(defaultSecondary);
  const [companyName, setCompanyName] = useState('Mi Agenda');
  const [logoUrl, setLogoUrl] = useState('');

  const refreshCompanyData = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('empresa')
      .select('nombre, color_primario, color_secundario, logo_url')
      .eq('user_id', user.id)
      .single();

    if (data) {
      if (data.color_primario) setPrimaryColor(data.color_primario);
      if (data.color_secundario) setSecondaryColor(data.color_secundario);
      if (data.nombre) setCompanyName(data.nombre);
      if (data.logo_url) setLogoUrl(data.logo_url);
    }
  };

  useEffect(() => {
    if (user) {
      refreshCompanyData();
    } else {
      setPrimaryColor(defaultPrimary);
      setSecondaryColor(defaultSecondary);
      setCompanyName('Mi Agenda');
      setLogoUrl('');
    }
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-secondary', secondaryColor);
  }, [primaryColor, secondaryColor]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, primaryColor, secondaryColor, refreshCompanyData, companyName, logoUrl }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
