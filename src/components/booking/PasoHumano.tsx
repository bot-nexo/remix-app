import BackButton from "../ui/BackButton";

interface Props {
    onVolver: () => void;
}

export default function PasoHumano({ onVolver }: Props) {
    return (
        <section>
            <BackButton
                text="Volver al Menú Principal"
                onClick={onVolver}
            />
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-slate-100"> Te transferimos con un humano</h2>
                <p className="mt-1 text-sm text-slate-400">
                    Te transferimos con un humano para ayudarte con tu solicitud.
                </p>

                <div>
                    
                </div>


            </div>
        </section>
    );
}