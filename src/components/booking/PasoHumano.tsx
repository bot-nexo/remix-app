import BackButton from "../ui/BackButton";
import { MessageCircle } from "lucide-react";

interface Props {
    onVolver: () => void;
    empresaNombre?: string;
}

export default function PasoHumano({ onVolver, empresaNombre }: Props) {
    const handleWhatsApp = () => {
        const mensaje = encodeURIComponent(
            `Hola, requiero hablar con usted. Soy cliente de ${empresaNombre || "este negocio"} y necesito atención personalizada.`
        );
        window.open(`https://wa.me/?text=${mensaje}`, "_blank");
    };

    return (
        <section>
            <BackButton
                text="Volver al Menú Principal"
                onClick={onVolver}
            />
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm text-center space-y-4">
                <MessageCircle className="w-12 h-12 mx-auto text-green-400" />
                <h2 className="text-xl font-semibold text-slate-100">
                    ¿Necesitas ayuda personalizada?
                </h2>
                <p className="text-sm text-slate-400">
                    Nuestro equipo está listo para atenderte por WhatsApp.
                </p>
                <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="mt-4 w-full rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 font-semibold text-white transition active:scale-[0.99]"
                >
                    💬 Abrir WhatsApp
                </button>
            </div>
        </section>
    );
}