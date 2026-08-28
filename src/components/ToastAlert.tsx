import { AlertCircle, CheckCircle2, X, XCircle } from "lucide-react";
import { removeToast } from "../functions";
import { Toast } from "../types/types";

{/* Container de Toasts */ }
export const ToastAlert = ({ toasts, setToasts }: { toasts: Toast[], setToasts: (toasts: Toast[]) => void }) => (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
            <div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${t.tipo === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : t.tipo === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    }`}
            >
                {t.tipo === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                {t.tipo === 'error' && <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
                {t.tipo === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}

                <div className="flex-1 text-xs font-semibold leading-relaxed">
                    {t.mensaje}
                </div>

                <button
                    onClick={() => removeToast(t.id, setToasts)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        ))}
    </div>
);