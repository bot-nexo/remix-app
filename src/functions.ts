import { Toast } from "./types/types";

export function formatearPrecio(valor: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(valor);
};

export function parsearHorario(textoHorario: string): { apertura: string; cierre: string } {
    let apertura = '09:00';
    let cierre = '19:00';

    if (textoHorario) {
        const match = textoHorario.match(/de\s+(\d+)\s*(a\.?m\.?|p\.?m\.?)\s*-\s*(\d+)\s*(a\.?m\.?|p\.?m\.?)/i);
        if (match) {
            let hInicio = parseInt(match[1], 10);
            const ampmInicio = match[2].toLowerCase();
            let hFin = parseInt(match[3], 10);
            const ampmFin = match[4].toLowerCase();

            if (ampmInicio.includes('p') && hInicio < 12) hInicio += 12;
            if (ampmInicio.includes('a') && hInicio === 12) hInicio = 0;
            if (ampmFin.includes('p') && hFin < 12) hFin += 12;
            if (ampmFin.includes('a') && hFin === 12) hFin = 0;

            apertura = `${hInicio.toString().padStart(2, '0')}:00`;
            cierre = `${hFin.toString().padStart(2, '0')}:00`;
        }
    }

    return { apertura, cierre };
}

export const removeToast = (id: number, setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
};

