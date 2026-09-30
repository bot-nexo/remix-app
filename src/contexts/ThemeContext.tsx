import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { DEFAULT_ANGEL_PALETTE, findAngelPalette } from '../constants/angelPalettes';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const dataEmpresa = localStorage.getItem('empresa');
const empresa = dataEmpresa ? JSON.parse(dataEmpresa) : null;

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  primaryColor: string;
  secondaryColor: string;
  refreshCompanyData: () => Promise<void>;
  companyName: string;
  logoUrl: string;
}

const defaultPalette = findAngelPalette(empresa?.color_primario, empresa?.color_secundario);
const defaultPrimary = defaultPalette.primary || DEFAULT_ANGEL_PALETTE.primary;
const defaultSecondary = defaultPalette.secondary || DEFAULT_ANGEL_PALETTE.secondary;

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => { },
  primaryColor: defaultPrimary,
  secondaryColor: defaultSecondary,
  refreshCompanyData: async () => { },
  companyName: empresa?.nombre || 'Mi Agenda',
  logoUrl: empresa?.logo_url || '',
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [primaryColor, setPrimaryColor] = useState(defaultPrimary);
  const [secondaryColor, setSecondaryColor] = useState(defaultSecondary);
  const [companyName, setCompanyName] = useState(empresa?.nombre || 'Mi Agenda');
  const [logoUrl, setLogoUrl] = useState(empresa?.logo_url || '');

  const refreshCompanyData = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('empresa')
      .select('nombre, color_primario, color_secundario, logo_url')
      .eq('user_id', user.id)
      .single();

    if (data) {
      const palette = findAngelPalette(data.color_primario, data.color_secundario);
      setPrimaryColor(palette.primary);
      setSecondaryColor(palette.secondary);
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
