import { ChevronLeft } from "lucide-react";

export default function BackButton({ text, onClick }: { text: string, onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className="mb-5 flex items-center gap-1 text-sm font-medium text-slate-200 hover:text-white transition-colors">
            <ChevronLeft size={16} />
            {text}
        </button>
    );
}
