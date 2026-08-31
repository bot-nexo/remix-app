import { Toast } from "./types/types";

export function formatearPrecio(valor: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(valor);
};

export const showToast = (mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success', setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => {
        removeToast(id, setToasts);
    }, 4000);
};


export const removeToast = (id: number, setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
};

