import React from 'react';
import { X, MessageSquare, Bot, Clock, UserCheck, Terminal, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface WhatsAppHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppHelpModal({ isOpen, onClose }: WhatsAppHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl ring-1 ring-emerald-500/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Guía Rápida: Bot de WhatsApp
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Auto-Detección
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cómo funciona la interacción entre la profesional y el bot inteligente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Highlight Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-900/30 dark:to-slate-900 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">
                ¡No tienes que apagar el bot para hablar con tus clientas!
              </strong>
              El sistema detecta automáticamente cuando tú respondes desde tu WhatsApp y se aparta de inmediato.
            </div>
          </div>

          {/* Core Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: Auto Silenciado */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <UserCheck className="w-4 h-4" />
                <span>1. Intervención Manual</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cuando envías cualquier mensaje a una clienta desde tu WhatsApp móvil o Web, el bot entiende que estás atendiendo y pasa el chat a estado <strong className="text-slate-700 dark:text-slate-200">HUMANO</strong>.
              </p>
            </div>

            {/* Rule 2: 2 Horas Reseteo */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>2. Reactivación (2h Inactividad)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Si pasan <strong className="text-slate-700 dark:text-slate-200">2 horas continuas</strong> sin mensajes nuevos en ese chat, el bot vuelve automáticamente a modo automático para futuros mensajes.
              </p>
            </div>
          </div>

          {/* Commands Reference Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" />
              Comandos Rápidos de WhatsApp
            </h3>

            <div className="space-y-2">
              {/* Command cerrar. */}
              <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800">
                    cerrar.
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Reactivar Bot Inmediatamente</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Escribe esto en el chat cuando termines de hablar para devolverle el control al bot.</span>
                  </div>
                </div>
              </div>

              {/* Command pausar. */}
              <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800">
                    pausar.
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Silenciar Bot Manualmente</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Pausa el bot de inmediato para esa clienta antes de que responda.</span>
                  </div>
                </div>
              </div>

              {/* Command asesor */}
              <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-300 dark:border-blue-800">
                    asesor
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Solicitado por la Clienta</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Si la clienta escribe "asesor" o "humano", el bot se silencia y te notifica.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
