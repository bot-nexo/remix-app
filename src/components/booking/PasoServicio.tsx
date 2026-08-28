import { useEffect, useState } from "react";
import BackButton from "../ui/BackButton";
import { obtenerServiciosActivos } from "@/src/services/serviciosService";
import { Servicio } from "@/src/types/types";



interface Props {
    servicioSeleccionado: Servicio | null;
    onSeleccionar: (servicio: Servicio) => void;
    onContinuar: () => void;
    formatearPrecio: (valor: number) => string;
    onVolver: () => void;
}

//***************************************** */
export default function PasoServicio({
    servicioSeleccionado,
    onSeleccionar,
    onContinuar,
    formatearPrecio,
    onVolver,
}: Props) {

    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    //**************************** */
    useEffect(() => {
        cargarServicios();
    }, []);

    const cargarServicios = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await obtenerServiciosActivos();
            if (data.length > 0) {
                setServicios(data);
            } else {
                setError("No se pudo cargar los servicios");
            }

        } catch (err) {
            console.error(err);
            setError('No pudimos cargar los servicios.');
        } finally {
            setLoading(false);
        }
    }

    //**************************** */
    return (
        <section>
            <BackButton
                text="Volver al Menú Principal"
                onClick={onVolver}
            />
            <h2 className="mb-4 text-xl font-semibold text-slate-100">¿Qué servicio deseas?</h2>

            {loading && (
                <div className="rounded-2xl bg-slate-800/80 border border-slate-700/50 p-6 text-center shadow-lg backdrop-blur-sm">
                    <p className="text-slate-400">Cargando servicios...</p>
                </div>
            )}

            {!loading && error && (
                <div className="rounded-2xl bg-red-950/40 border border-red-900/50 p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button
                        type="button"
                        onClick={() => cargarServicios()}
                        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
                    >
                        Intentar nuevamente
                    </button>
                </div>
            )}

            {!loading && !error && servicios.length === 0 && (
                <div className="rounded-2xl bg-slate-800/80 border border-slate-700/50 p-6 text-center shadow-lg">
                    <p className="text-[var(--brand-primary)]">No hay servicios disponibles.</p>
                </div>
            )}

            {!loading && !error && servicios.length > 0 && (
                <div className="space-y-3">
                    {servicios.map((servicio) => {
                        const seleccionado = servicioSeleccionado?.id === servicio.id;
                        return (
                            <button
                                key={servicio.id}
                                type="button"
                                onClick={() => onSeleccionar(servicio)}
                                style={{
                                    borderColor: seleccionado ? 'var(--brand-primary)' : undefined,
                                    backgroundColor: seleccionado ? 'rgba(255, 255, 255, 0.03)' : undefined,
                                }}
                                className={`
                                        w-full rounded-2xl border p-5 text-left transition duration-200
                                        ${!seleccionado && 'border-slate-800 bg-slate-800/60 hover:border-slate-700 hover:bg-slate-800'}
                                    `}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-100">{servicio.nombre}</h3>
                                        <p className="mt-1 text-sm text-slate-400">{servicio.duracion_minutos} minutos</p>
                                    </div>
                                    <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>
                                        {formatearPrecio(Number(servicio.valor))}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {servicioSeleccionado && (
                <div className="mt-6 rounded-2xl bg-slate-600/20 border border-slate-200/40 p-5 backdrop-blur-sm"
                    style={{ boxShadow: '3px 3px 10px 0px var(--brand-primary)', border: '1px solid var(--brand-primary)' }}>
                    <p className="text-sm uppercase tracking-wider font-semibold">Servicio seleccionado</p>
                    <div className="mt-2 flex items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-slate-100">{servicioSeleccionado.nombre}</p>
                            <p className="text-sm text-slate-400">{servicioSeleccionado.duracion_minutos} minutos</p>
                        </div>
                        <span className="font-bold" style={{ color: 'var(--brand-primary)' }}>
                            {formatearPrecio(Number(servicioSeleccionado.valor))}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onContinuar}
                        className="mt-5 w-full rounded-xl px-4 py-3 font-semibold text-slate-50 transition hover:brightness-110"
                        style={{ backgroundColor: 'var(--brand-primary)', border: 'none', cursor: 'pointer' }}
                    >
                        Continuar
                    </button>
                </div>
            )}
        </section>
    );
}