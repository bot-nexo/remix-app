

export default function BackButton({ text, onClick }: { text: string, onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="mb-4 text-sm font-medium text-[var(--brand-primary)] hover:text-slate-300 transition"
        >
            ← {text}
        </button>
    );
}