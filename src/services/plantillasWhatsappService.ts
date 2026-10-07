import { supabase } from '../lib/supabase';

export type TipoPlantillaWhatsapp =
  | 'confirmacion'
  | 'recordatorio'
  | 'cancelacion'
  //| 'seguimiento'
  // | 'promocion'
  ;

export interface PlantillaWhatsapp {
  id: TipoPlantillaWhatsapp;
  nombre: string;
  descripcion: string;
  titulo: string;
  cuerpo: string;
  accion: string; // Acción / CTA (opcional o requerida)
  activa: boolean;
}

export const VARIABLES_DISPONIBLES = [
  { clave: '{nombre_cliente}', etiqueta: 'Nombre del Cliente', ejemplo: 'María Paula' },
  { clave: '{servicio}', etiqueta: 'Nombre del Servicio', ejemplo: 'Manicura Rusa Express' },
  { clave: '{fecha_cita}', etiqueta: 'Fecha de la Cita', ejemplo: '12 de Octubre, 2026' },
  { clave: '{hora_cita}', etiqueta: 'Hora de la Cita', ejemplo: '03:30 PM' },
  { clave: '{nombre_empresa}', etiqueta: 'Nombre del Negocio', ejemplo: 'Angel Nails' },
  { clave: '{direccion_empresa}', etiqueta: 'Dirección del Local', ejemplo: 'Calle 45 # 18-24, Local 2' },
  { clave: '{link_reserva}', etiqueta: 'Enlace de Agendamiento', ejemplo: 'https://angelnails.com/reservar' },
];

export const PLANTILLAS_POR_DEFECTO: Record<TipoPlantillaWhatsapp, PlantillaWhatsapp> = {
  confirmacion: {
    id: 'confirmacion',
    nombre: 'Confirmación de Cita',
    descripcion: 'Enviado automáticamente cuando una nueva cita es reservada.',
    titulo: '✨ CITA CONFIRMADA EXITOSAMENTE',
    cuerpo:
      'Hola {nombre_cliente}, ¡tu reserva ha sido agendada con éxito en {nombre_empresa}!\n\n💅 *Servicio:* {servicio}\n📅 *Fecha:* {fecha_cita}\n⏰ *Hora:* {hora_cita}\n📍 *Ubicación:* {direccion_empresa}\n\nEstamos muy entusiasmados por atenderte.',
    accion: 'Si necesitas modificar o reprogramar tu cita, responde a este mensaje o ingresa a {link_reserva}.',
    activa: true,
  },
  recordatorio: {
    id: 'recordatorio',
    nombre: 'Recordatorio de Cita Próxima',
    descripcion: 'Enviado previo a la cita para asegurar asistencia.',
    titulo: '⏰ RECORDATORIO DE TU PRÓXIMA CITA',
    cuerpo:
      'Hola {nombre_cliente}, queremos recordarte que tienes una cita programada para mañana en {nombre_empresa}.\n\n✨ *Servicio:* {servicio}\n📅 *Fecha:* {fecha_cita}\n⏰ *Hora:* {hora_cita}',
    accion: 'Por favor responde *1* para CONFIRMAR tu asistencia o *2* si deseas REPROGRAMAR.',
    activa: true,
  },
  cancelacion: {
    id: 'cancelacion',
    nombre: 'Cancelación de Cita',
    descripcion: 'Notificación de cancelación de una reserva.',
    titulo: '❌ CITA CANCELADA',
    cuerpo:
      'Hola {nombre_cliente}, confirmamos que tu cita para el servicio de {servicio} programada el {fecha_cita} a las {hora_cita} ha sido cancelada.',
    accion: 'Si deseas agendar un nuevo espacio, puedes volver a reservar aquí: {link_reserva}',
    activa: true,
  },
  // seguimiento: {
  //   id: 'seguimiento',
  //   nombre: 'Seguimiento Post-Servicio',
  //   descripcion: 'Enviado después de la cita para valorar la experiencia.',
  //   titulo: '💜 ¡GRACIAS POR TU VISITA!',
  //   cuerpo:
  //     'Hola {nombre_cliente}, esperamos que hayas quedado feliz con tu servicio de {servicio} en {nombre_empresa}.\n\nPara nosotros tu opinión es extremadamente valiosa.',
  //   accion: 'Cuéntanos del 1 al 5 qué tal te pareció la atención hoy. ¡Que tengas un día radiante! 🌟',
  //   activa: true,
  // },
  // promocion: {
  //   id: 'promocion',
  //   nombre: 'Mensaje Promocional / Difusión',
  //   descripcion: 'Plantilla personalizable para novedades u ofertas especiales.',
  //   titulo: '🎉 ¡TENEMOS UNA SORPRESA PARA TI!',
  //   cuerpo:
  //     'Hola {nombre_cliente}, queremos invitarte a conocer nuestras nuevas tendencias y promociones exclusivas del mes en {nombre_empresa}.',
  //   accion: '¡Agenda hoy mismo tu cita con descuento aquí! 👉 {link_reserva}',
  //   activa: true,
  // },
};

const CLAVE_CONFIGURACION = 'wa_plantillas_mensajes_v1';

/**
 * Cargar plantillas desde Supabase (o por defecto si no existen)
 */
export async function obtenerPlantillasWhatsapp(
  userId: string
): Promise<Record<TipoPlantillaWhatsapp, PlantillaWhatsapp>> {
  if (!userId) return PLANTILLAS_POR_DEFECTO;

  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('user_id', userId)
      .eq('clave', CLAVE_CONFIGURACION)
      .maybeSingle();

    if (error) {
      console.warn('Error al leer plantillas de WhatsApp:', error.message);
      return PLANTILLAS_POR_DEFECTO;
    }

    if (data && data.valor) {
      const guardadas = JSON.parse(data.valor);
      return {
        ...PLANTILLAS_POR_DEFECTO,
        ...guardadas,
      };
    }
  } catch (err) {
    console.error('Error parseando plantillas de WhatsApp:', err);
  }

  return PLANTILLAS_POR_DEFECTO;
}

/**
 * Guardar plantillas en Supabase
 */
export async function guardarPlantillasWhatsapp(
  userId: string,
  plantillas: Record<TipoPlantillaWhatsapp, PlantillaWhatsapp>
): Promise<void> {
  if (!userId) throw new Error('Usuario no autenticado');

  const valor = JSON.stringify(plantillas);

  const { error } = await supabase.from('configuracion').upsert(
    {
      user_id: userId,
      clave: CLAVE_CONFIGURACION,
      valor: valor,
    },
    { onConflict: 'user_id,clave' }
  );

  if (error) {
    console.error('Error al guardar plantillas en Supabase:', error);
    throw new Error(error.message || 'Error al guardar plantillas.');
  }
}

/**
 * Formatear un mensaje completo reemplazando variables dinámicas y estructurando Título, Cuerpo y Acción.
 */
export function estructurarMensajeCompleto(
  plantilla: PlantillaWhatsapp,
  datosPrueba?: Record<string, string>
): string {
  const sustitutos: Record<string, string> = {
    '{nombre_cliente}': datosPrueba?.nombre_cliente || 'María Paula',
    '{servicio}': datosPrueba?.servicio || 'Manicura Rusa Express',
    '{fecha_cita}': datosPrueba?.fecha_cita || '15 de Octubre, 2026',
    '{hora_cita}': datosPrueba?.hora_cita || '04:00 PM',
    '{nombre_empresa}': datosPrueba?.nombre_empresa || 'Angel Nails Studio',
    '{direccion_empresa}': datosPrueba?.direccion_empresa || 'Calle 45 # 18-24, Local 2',
    '{link_reserva}': datosPrueba?.link_reserva || 'https://angelnails.com/reservar',
  };

  const reemplazar = (texto: string) => {
    let resultado = texto || '';
    Object.entries(sustitutos).forEach(([variable, valor]) => {
      resultado = resultado.split(variable).join(valor);
    });
    return resultado;
  };

  const tituloProc = reemplazar(plantilla.titulo).trim();
  const cuerpoProc = reemplazar(plantilla.cuerpo).trim();
  const accionProc = reemplazar(plantilla.accion).trim();

  let mensajeFinal = '';

  if (tituloProc) {
    mensajeFinal += `*${tituloProc}*\n\n`;
  }

  if (cuerpoProc) {
    mensajeFinal += `${cuerpoProc}\n`;
  }

  if (accionProc) {
    mensajeFinal += `\n─────────────────────\n*👉 Acción / Respuesta:* ${accionProc}`;
  }

  return mensajeFinal.trim();
}
