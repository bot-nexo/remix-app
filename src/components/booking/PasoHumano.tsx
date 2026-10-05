import { MessageCircle } from "lucide-react";
import BackButton from "../ui/BackButton";

interface Props {
    onVolver: () => void;
    empresaNombre?: string;
    telefonoProfesional?: string;
}

export default function PasoHumano({ onVolver, empresaNombre, telefonoProfesional }: Props) {
    const handleWhatsApp = () => {
        const mensaje = encodeURIComponent(
            `Hola, requiero hablar con usted. Soy cliente de ${empresaNombre || "este negocio"} y necesito atención personalizada.`
        );
        const phone = (telefonoProfesional || '').replace(/\D/g, '');
        if (!phone) return;
        window.open(`https://wa.me/${phone}?text=${mensaje}`, "_blank", "noopener,noreferrer");
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
                <p className="text-sm text-slate-300">
                    Nuestro equipo está listo para atenderte por WhatsApp.
                </p>
                <button
                    type="button"
                    onClick={handleWhatsApp}
                    disabled={!telefonoProfesional}
                    className="mt-4 w-full rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 font-semibold text-white transition active:scale-[0.99]"
                >
                    {telefonoProfesional ? 'Abrir WhatsApp' : 'WhatsApp no configurado'}
                </button>
            </div>
        </section>
    );
}
