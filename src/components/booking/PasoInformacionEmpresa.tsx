import { UserStar } from 'lucide-react';
import { findAngelPalette } from '../../constants/angelPalettes';
import { EmpresaConfig } from '../../services/empresaService';
import BackButton from '../ui/BackButton';

interface Props {
  empresa: EmpresaConfig | null;
  onVolver: () => void;
}

export default function PasoInformacionEmpresa({ empresa, onVolver }: Props) {
  const brandColor = findAngelPalette(empresa?.color_primario, empresa?.color_secundario).primary;
  return (
    <section className="space-y-4">
      <BackButton
        text="Volver al Menú Principal"
        onClick={onVolver}
      />

      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-4">
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre}
              className="h-16 w-16 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl border border-slate-700">
              <UserStar color={brandColor} />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              {empresa?.nombre || 'Angel Nails'}
            </h2>
            <p className="text-xs text-slate-300 font-medium">Información General</p>
          </div>
        </div>

        <div className="space-y-4 divide-y divide-slate-700/50 text-sm">
          {/* Ubicación */}
          <div className="pt-2 flex items-start gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="font-semibold text-[var(--brand-primary)]">Ubicación</p>
              <p className="text-slate-300">{empresa?.direccion || 'No especificada'}</p>
            </div>
          </div>

          {/* Horario */}
          <div className="pt-4 flex items-start gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <p className="font-semibold text-[var(--brand-primary)]">Horario de Atención</p>
              <p className="text-slate-300 whitespace-pre-line">
                {empresa?.horario || 'Lunes a Sábado: 8:00 AM - 7:00 PM'}
              </p>
            </div>
          </div>

          {/* Políticas */}
          <div className="pt-4 flex items-start gap-3">
            <span className="text-xl">📋</span>
            <div>
              <p className="font-semibold text-[var(--brand-primary)]">Políticas del Servicio</p>
              <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                {empresa?.politicas || 'Tolerancia máxima de 15 minutos de retraso. Cancelaciones con al menos 2 horas de anticipación.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
