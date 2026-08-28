import { supabase } from '../lib/supabase';

const USER_ID = import.meta.env.VITE_NEGOCIO_USER_ID;

export async function obtenerHorariosDisponibles(fechaStr: string, duracionMinutos: number) {
  if (!USER_ID) {
    throw new Error('Falta VITE_NEGOCIO_USER_ID en las variables de entorno.');
  }

  // 1. Obtener la configuración del horario desde la tabla 'empresa'
  const { data: empresas, error: errEmpresa } = await supabase
    .from('empresa')
    .select('horario')
    .eq('user_id', USER_ID)
    .limit(1);

  if (errEmpresa) {
    console.error('Error obteniendo datos de la empresa:', errEmpresa);
    throw errEmpresa;
  }

  // Horarios por defecto en caso de no poder interpretar el texto
  let horaAperturaMin = 8 * 60;   // 08:00 (480 min)
  let horaCierreMin = 19 * 60;   // 19:00 / 7 p.m. (1140 min)

  if (empresas && empresas.length > 0 && empresas[0].horario) {
    const textoHorario = empresas[0].horario; // "Lunes a Domingo de 8 a.m - 7 p.m"
    
    // Extraemos horas de apertura y cierre usando expresión regular
    const match = textoHorario.match(/de\s+(\d+)\s*(a\.?m\.?|p\.?m\.?)\s*-\s*(\d+)\s*(a\.?m\.?|p\.?m\.?)/i);
    
    if (match) {
      let hInicio = parseInt(match[1], 10);
      const ampmInicio = match[2].toLowerCase();
      let hFin = parseInt(match[3], 10);
      const ampmFin = match[4].toLowerCase();

      // Convertir formato 12h a formato 24h en minutos
      if (ampmInicio.includes('p') && hInicio < 12) hInicio += 12;
      if (ampmInicio.includes('a') && hInicio === 12) hInicio = 0;

      if (ampmFin.includes('p') && hFin < 12) hFin += 12;
      if (ampmFin.includes('a') && hFin === 12) hFin = 0;

      horaAperturaMin = hInicio * 60;
      horaCierreMin = hFin * 60;
    }
  }

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
    .neq('estado', 'CANCELADO_CLIENTE');

  if (errCitas) console.error('Error cargando citas:', errCitas);

  // 3. Generar tramos/slots de 30 minutos
  const slots: string[] = [];
  let actual = horaAperturaMin;

  while (actual + duracionMinutos <= horaCierreMin) {
    const slotInicio = actual;
    const slotFin = actual + duracionMinutos;

    // Verificar si el slot choca con algún bloqueo de agenda
    const chocaconBloqueo = (bloqueos || []).some((b) => {
      const bInicio = horaAEstadoMinutos(b.hora_inicio);
      const bFin = horaAEstadoMinutos(b.hora_fin);
      return slotInicio < bFin && slotFin > bInicio;
    });

    // Verificar si el slot choca con alguna cita activa
    const chocaconCita = (citas || []).some((c) => {
      const cInicio = horaAEstadoMinutos(c.hora_inicio);
      const cFin = horaAEstadoMinutos(c.hora_fin);
      return slotInicio < cFin && slotFin > cInicio;
    });

    if (!chocaconBloqueo && !chocaconCita) {
      slots.push(minutosAHora(slotInicio));
    }

    actual += 30; // Saltos de 30 min
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