import { supabase } from '../lib/supabase';

const USER_ID = import.meta.env.VITE_NEGOCIO_USER_ID;

/**
 * Verifica si una fecha tiene horario_atencion configurado (mes habilitado por el admin)
 */
async function verificarHorarioAtencion(fechaStr: string): Promise<{ disponible: boolean; horaInicio: string; horaFin: string }> {
  if (!USER_ID) return { disponible: false, horaInicio: '08:00', horaFin: '19:00' };

  const { data, error } = await supabase
    .from('horario_atencion')
    .select('hora_inicio, hora_fin, activo')
    .eq('user_id', USER_ID)
    .eq('fecha', fechaStr)
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.activo) {
    return { disponible: false, horaInicio: '08:00', horaFin: '19:00' };
  }

  // Extraer horas del registro horario_atencion (formato HH:MM:SS o HH:MM)
  const hInicio = data.hora_inicio?.split(':').slice(0, 2).join(':') || '08:00';
  const hFin = data.hora_fin?.split(':').slice(0, 2).join(':') || '19:00';

  return { disponible: true, horaInicio: hInicio, horaFin: hFin };
}

/**
 * Verifica si una fecha tiene al menos un slot disponible para la duración dada.
 * Útil para el date picker: deshabilitar días completamente copados.
 */
export async function verificarDisponibilidadFecha(fechaStr: string, duracionMinutos: number): Promise<boolean> {
  const slots = await obtenerHorariosDisponibles(fechaStr, duracionMinutos);
  return slots.length > 0;
}

export async function obtenerHorariosDisponibles(fechaStr: string, duracionMinutos: number) {
  if (!USER_ID) {
    throw new Error('Falta VITE_NEGOCIO_USER_ID en las variables de entorno.');
  }

  // 1. Verificar si la fecha tiene horario_atencion configurado
  const horarioDia = await verificarHorarioAtencion(fechaStr);
  if (!horarioDia.disponible) {
    // El día no está habilitado por el admin — no hay slots
    return [];
  }

  const horaAperturaMin = horaAEstadoMinutos(horarioDia.horaInicio);
  const horaCierreMin = horaAEstadoMinutos(horarioDia.horaFin);

  // 2. Consultar bloqueos y citas existentes para la fecha seleccionada
  const { data: bloqueos, error: errBloqueos } = await supabase
    .from('bloqueos_agenda')
    .select('hora_inicio, hora_fin')
    .eq('user_id', USER_ID)
    .eq('fecha', fechaStr);

  if (errBloqueos) console.error('Error cargando bloqueos:', errBloqueos);

  const { data: citas, error: errCitas } = await supabase
    .from('citas')
    .select('hora_inicio, hora_fin')
    .eq('user_id', USER_ID)
    .gte('fecha_inicio', `${fechaStr}T00:00:00`)
    .lte('fecha_inicio', `${fechaStr}T23:59:59`)
    .neq('estado', 'CANCELADO_INASISTENCIA')
    .neq('estado', 'CANCELADO_CLIENTE')
    .neq('estado', 'CANCELADO');

  if (errCitas) console.error('Error cargando citas:', errCitas);

  // 3. Generar tramos/slots con intervalo igual a la duración del servicio
  const slots: string[] = [];
  let actual = horaAperturaMin;

  while (actual + duracionMinutos <= horaCierreMin) {
    const slotInicio = actual;
    const slotFin = actual + duracionMinutos;

    const chocaConBloqueo = (bloqueos || []).some((b) => {
      const bInicio = horaAEstadoMinutos(b.hora_inicio);
      const bFin = horaAEstadoMinutos(b.hora_fin);
      return slotInicio < bFin && slotFin > bInicio;
    });

    const chocaConCita = (citas || []).some((c) => {
      const cInicio = horaAEstadoMinutos(c.hora_inicio);
      const cFin = horaAEstadoMinutos(c.hora_fin);
      return slotInicio < cFin && slotFin > cInicio;
    });

    if (!chocaConBloqueo && !chocaConCita) {
      slots.push(minutosAHora(slotInicio));
    }

    // El intervalo es igual a la duración del servicio para evitar solapamientos
    actual += duracionMinutos;
  }

  return slots;
}

function horaAEstadoMinutos(horaStr: string): number {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}