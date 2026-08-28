import BackButton from "../ui/BackButton";

interface Props {
    onVolver: () => void;
}

export default function PasoConsultarCita({ onVolver }: Props) {
    return (
        <section>
            <BackButton
                text="Volver a Servicios"
                onClick={onVolver}
            />
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-slate-100">Consultar Citas</h2>
                <p className="mt-1 text-sm text-slate-400">
                    Consulta tus citas existentes y realiza modificaciones si lo deseas.
                </p>


            </div>
        </section>
    );
}