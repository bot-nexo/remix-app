import { Wrench } from 'lucide-react';

interface Props {
  onVolver: () => void;
  titulo?: string;
  descripcion?: string;
}

export default function EnDesarrollo({
  onVolver,
  titulo = "Funcionalidad en Desarrollo",
  descripcion = "Estamos trabajando para ofrecerte la mejor experiencia posible en este módulo. ¡Estará disponible muy pronto!"
}: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800/80 p-8 sm:p-10 text-center shadow-2xl backdrop-blur-md transition-all">
      {/* Resplandor decorativo de fondo con el color primario */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Ícono de estado con anillo dinámico */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-slate-950/60 shadow-inner"
          style={{
            borderColor: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)',
            color: 'var(--brand-primary)'
          }}
        >
          <Wrench className="h-7 w-7 animate-pulse" />
        </div>

        {/* Badge superior */}
        <span
          className="mt-6 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border bg-slate-950/40"
          style={{
            color: 'var(--brand-primary)',
            borderColor: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)'
          }}
        >
          Próximamente
        </span>

        {/* Título y Descripción */}
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          {titulo}
        </h2>

        <p className="mt-3 max-w-sm text-sm text-slate-400 leading-relaxed">
          {descripcion}
        </p>

        {/* Botón de Acción Principal */}
        <button
          type="button"
          onClick={onVolver}
          style={{ backgroundColor: 'var(--brand-primary)' }}
          className="mt-8 w-full max-w-xs rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-black/20"
        >
          Volver al Menú Principal
        </button>
      </div>
    </section>
  );
}