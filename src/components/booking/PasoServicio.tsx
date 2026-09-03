import { useEffect, useState } from "react";
import BackButton from "../ui/BackButton";
import { obtenerServiciosActivos } from "@/src/services/serviciosService";
import { Servicio } from "@/src/types/types";
import { Check } from "lucide-react";

interface Props {
    servicioSeleccionado: Servicio | null;
    onSeleccionar: (servicio: Servicio) => void;
    onContinuar: () => void;
    formatearPrecio: (valor: number) => string;
    onVolver: () => void;
}

export default function PasoServicio({ servicioSeleccionado, onSeleccionar, onContinuar, formatearPrecio, onVolver }: Props) {
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { cargarServicios(); }, []);

    const cargarServicios = async () => {
        try {
            setLoading(true); setError('');
            const data = await obtenerServiciosActivos();
            if (data.length > 0) setServicios(data);
            else setError("No hay servicios disponibles");
        } catch (err) { setError('No pudimos cargar los servicios.'); }
        finally { setLoading(false); }
    };

    const colorPrimario = 'var(--brand-primary)';

    return (
        <section>
            <BackButton text="Volver al Menú" onClick={onVolver} />
            <h2 className="mb-1 text-lg font-bold text-white">¿Qué servicio deseas?</h2>
            <p className="text-xs text-slate-500 mb-5">Elige el tratamiento que prefieras</p>

            {loading && (
                <div className="rounded-2xl border border-white/5 p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: `${colorPrimario}40`, borderTopColor: 'transparent' }}></div>
                    <p className="text-sm text-slate-500">Cargando servicios...</p>
                </div>
            )}

            {!loading && error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                    <p className="text-sm text-red-400">{error}</p>
                    <button onClick={cargarServicios} className="mt-3 text-xs font-medium text-red-400 underline hover:text-red-300">Intentar de nuevo</button>
                </div>
            )}

            {!loading && !error && servicios.length > 0 && (
                <div className="space-y-2">
                    {servicios.map((servicio) => {
                        const seleccionado = servicioSeleccionado?.id === servicio.id;
                        return (
                            <button key={servicio.id} type="button" onClick={() => onSeleccionar(servicio)}
                                className="w-full rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98]"
                                style={{
                                    borderColor: seleccionado ? colorPrimario : 'rgba(255,255,255,0.05)',
                                    background: seleccionado ? `${colorPrimario}10` : 'rgba(255,255,255,0.02)',
                                }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-white">{servicio.nombre}</h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{servicio.duracion_minutos} minutos</p>
                                    </div>
                                    <span className="text-sm font-bold shrink-0" style={{ color: colorPrimario }}>
                                        {formatearPrecio(Number(servicio.valor))}
                                    </span>
                                    {seleccionado && (
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: colorPrimario }}>
                                            <Check size={12} className="text-white" />
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {servicioSeleccionado && (
                <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: `${colorPrimario}40`, background: `${colorPrimario}08` }}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Seleccionado</p>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-white">{servicioSeleccionado.nombre}</p>
                            <p className="text-[11px] text-slate-400">{servicioSeleccionado.duracion_minutos} min</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: colorPrimario }}>{formatearPrecio(Number(servicioSeleccionado.valor))}</span>
                    </div>
                    <button type="button" onClick={onContinuar}
                        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:brightness-110"
                        style={{ background: colorPrimario }}>
                        Continuar
                    </button>
                </div>
            )}
        </section>
    );
}
