import React, { createContext, useContext, useState } from 'react';
import { ToastAlert } from '../components/ToastAlert'
import { Toast } from '../types/types';

interface ToastContextType {
  showToast: (mensaje: string, tipo?: 'success' | 'error' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    const newToast: Toast = { id, mensaje, tipo };

    setToasts((prev) => [...prev, newToast]);

    // Auto eliminar después de 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* El contenedor se renderiza aquí una sola vez de forma global */}
      <ToastAlert toasts={toasts} setToasts={setToasts} />
    </ToastContext.Provider>
  );
};

// Hook personalizado para usarlo fácilmente
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser usado dentro de un ToastProvider');
  }
  return context;
};