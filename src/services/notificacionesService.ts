import { supabase } from '../lib/supabase';
import { TipoPlantillaWhatsapp, estructurarMensajeCompleto, obtenerPlantillasWhatsapp } from './plantillasWhatsappService';

const AUTORESPONDER_URL = import.meta.env.DEV
  ? '/autoresponder-api'
  : import.meta.env.VITE_AUTORESPONDER_URL || '';

export interface DatosNotificacion {
  nombre_cliente: string;
  telefono_cliente: string;
  servicio?: string;
  fecha_cita?: string;
  hora_cita?: string;
  nombre_empresa?: string;
  direccion_empresa?: string;
  link_reserva?: string;
}

/**
 * Enviar una notificación por WhatsApp utilizando la plantilla personalizada de Supabase.
 */
export async function enviarNotificacionPlantilla(
  tipo: TipoPlantillaWhatsapp,
  datos: DatosNotificacion
): Promise<{ ok: boolean; mensaje?: string }> {
  if (!datos.telefono_cliente) {
    console.warn('[NOTIFICACIÓN] No se proporcionó teléfono de cliente.');
    return { ok: false, mensaje: 'Falta teléfono del cliente.' };
  }

  const cleanNum = datos.telefono_cliente.replace(/\D/g, '');
  if (!cleanNum) {
    return { ok: false, mensaje: 'Número de teléfono no válido.' };
  }

  try {
    // Si tenemos URL del microservicio configurada, intentamos enviar vía API del backend
    if (AUTORESPONDER_URL) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const res = await fetch(`${AUTORESPONDER_URL.replace(/\/$/, '')}/api/templates/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: cleanNum,
          templateType: tipo,
          data: datos,
        }),
      });

      if (res.ok) {
        return { ok: true, mensaje: 'Mensaje enviado a través del servidor de WhatsApp.' };
      }
    }

    // Fallback directo: Si el microservicio no está disponible, estructurar mensaje para abrir por WhatsApp Web/App
    const userId = (await supabase.auth.getUser()).data.user?.id || '';
    const plantillas = await obtenerPlantillasWhatsapp(userId);
    const plantilla = plantillas[tipo];

    if (plantilla) {
      const mensajeTexto = estructurarMensajeCompleto(plantilla, {
        nombre_cliente: datos.nombre_cliente,
        servicio: datos.servicio || '',
        fecha_cita: datos.fecha_cita || '',
        hora_cita: datos.hora_cita || '',
        nombre_empresa: datos.nombre_empresa || '',
        direccion_empresa: datos.direccion_empresa || '',
        link_reserva: datos.link_reserva || '',
      });

      const encoded = encodeURIComponent(mensajeTexto);
      window.open(`https://wa.me/${cleanNum}?text=${encoded}`, '_blank');
      return { ok: true, mensaje: 'Mensaje abierto en WhatsApp Web/App.' };
    }
  } catch (err: any) {
    console.error('[NOTIFICACIÓN] Error enviando notificación:', err);
    return { ok: false, mensaje: err.message || 'Error al procesar la notificación.' };
  }

  return { ok: false, mensaje: 'No se pudo enviar la notificación.' };
}
