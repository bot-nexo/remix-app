/**
 * whatsapp-autoresponder
 * ──────────────────────────────────────────────────────────────────────────
 * Microservicio contestador automático de WhatsApp integrado con Evolution API.
 *
 * Responsabilidades:
 *  - Recibir webhooks de Evolution API y responder mensajes de WhatsApp.
 *  - Detectar peticiones de atención humana (silenciar el bot por cooldown).
 *  - Resolver preguntas frecuentes (FAQs) con respuestas configurables.
 *  - Exponer una API REST de administración para leer/actualizar config en caliente.
 *  - Gestionar clientes, estado de conversación y configuración en Supabase.
 *  - Cargar información de la empresa (horario, ubicación, nombre del bot) desde BD.
 *
 * Autor: <NexoDevStudio>
 * Licencia: MIT
 */

'use strict';

// ─── Carga de variables de entorno ───────────────────────────────────────────
require('dotenv').config();

// ─── Módulos core / externos ──────────────────────────────────────────────────
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { verifyEvolutionWebhookToken } = require('./webhookAuth');

// ─── Constantes de entorno ────────────────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8480';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'default';
const EVOLUTION_WEBHOOK_URL = process.env.EVOLUTION_WEBHOOK_URL || `http://localhost:${PORT}/webhook/evolution`;
const EVOLUTION_WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';
const WHATSAPP_ADMIN_USER_ID = process.env.WHATSAPP_ADMIN_USER_ID || '';
const BOOKING_LINK_SECRET = process.env.BOOKING_LINK_SECRET || '';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://angelnails.tech',
  'https://www.angelnails.tech',
  'https://angelnailsagenda.netlify.app',
  'http://localhost:5757',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5757',
  'http://127.0.0.1:5173',
];
const envOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const FRONTEND_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CONFIG_ISSUES = [];

if (NODE_ENV === 'production') {
  const requiredSettings = {
    ADMIN_API_KEY,
    EVOLUTION_API_URL,
    EVOLUTION_API_KEY,
    EVOLUTION_WEBHOOK_URL,
    EVOLUTION_WEBHOOK_SECRET,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_ADMIN_USER_ID,
    BOOKING_LINK_SECRET,
    FRONTEND_ORIGINS: FRONTEND_ORIGINS.size ? 'configured' : '',
  };
  const missingSettings = Object.entries(requiredSettings)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingSettings.length) {
    CONFIG_ISSUES.push(`Faltan variables de producción requeridas: ${missingSettings.join(', ')}`);
  }
  if (ADMIN_API_KEY.length < 32 || EVOLUTION_WEBHOOK_SECRET.length < 32 || BOOKING_LINK_SECRET.length < 32) {
    CONFIG_ISSUES.push('ADMIN_API_KEY, EVOLUTION_WEBHOOK_SECRET y BOOKING_LINK_SECRET deben tener al menos 32 caracteres.');
  }
  if (WHATSAPP_ADMIN_USER_ID && !/^[0-9a-f-]{36}$/i.test(WHATSAPP_ADMIN_USER_ID)) {
    CONFIG_ISSUES.push('WHATSAPP_ADMIN_USER_ID debe ser un UUID válido.');
  }

  if (CONFIG_ISSUES.length) {
    console.error('⚠️ [ADVERTENCIA DE CONFIGURACIÓN DEL SERVIDOR]:');
    CONFIG_ISSUES.forEach((issue) => console.error(`  - ${issue}`));
  }
}

const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

// ─── Ruta al archivo de configuración ────────────────────────────────────────
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');

// ─── Link del portal PWA (real) ──────────────────────────────────────────────
//const PWA_URL = 'https://angelnailsagenda.netlify.app/reservar';
const PWA_URL = 'https://angelnails.tech/reservar';

// ─────────────────────────────────────────────────────────────────────────────
// Sección 1 · Configuración en memoria (hot-reload)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee y parsea `config.json` desde disco.
 * @returns {object} Configuración parseada.
 */
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[CONFIG] Error al cargar config.json:', err.message);
    process.exit(1);
  }
}

/** Configuración activa en memoria. Mutable por el endpoint POST /api/config. */
let config = loadConfig();

/**
 * Datos de la empresa cargados desde BD (se refrescan en cada mensaje o al iniciar).
 */
let empresaData = null;

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2 · Utilidades de texto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un texto para comparación: minúsculas + sin tildes/diacríticos.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica si un texto corresponde al comando para cerrar atención humana ('cerrar.', 'cerrar', '.cerrar', etc.).
 * @param {string} text
 * @returns {boolean}
 */
function isCerrarCommand(text) {
  if (!text) return false;
  const clean = normalizeText(text.trim());
  return clean === 'cerrar.' || clean === 'cerrar' || clean === '.cerrar' || clean === '#cerrar' || clean === '*cerrar*';
}

/**
 * Verifica si un texto corresponde al comando para pausar el bot ('pausar.', 'pausar', '.pausar', etc.).
 * @param {string} text
 * @returns {boolean}
 */
function isPausarCommand(text) {
  if (!text) return false;
  const clean = normalizeText(text.trim());
  return clean === 'pausar.' || clean === 'pausar' || clean === '.pausar' || clean === '#pausar' || clean === '*pausar*';
}

function createBookingToken(clientId) {
  if (!BOOKING_LINK_SECRET) return '';
  const payload = Buffer.from(JSON.stringify({
    sub: clientId,
    exp: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', BOOKING_LINK_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyBookingToken(token) {
  if (!BOOKING_LINK_SECRET || typeof token !== 'string' || token.length > 2048) return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) return null;

  try {
    const expected = crypto.createHmac('sha256', BOOKING_LINK_SECRET).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims.sub !== 'string' || !claims.sub || !Number.isInteger(claims.exp) || claims.exp <= Date.now() / 1000) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

/**
 * Devuelve el JID canónico del remitente.
 * Meta está migrando identificadores de usuario de `@s.whatsapp.net` a `@lid`.
 */
function getCanonicalJid(data) {
  const alt = data?.key?.remoteJidAlt;
  if (alt && !alt.includes('@g.us') && !alt.includes('@newsletter')) {
    return alt;
  }
  return data?.key?.remoteJid || '';
}

/**
 * Extrae el número/LID limpio (solo dígitos) para consultar/crear en BD.
 */
function extractCleanIdentifier(jid) {
  const firstPart = (jid || '').split('@')[0] || '';
  return firstPart.replace(/\D/g, '');
}

/**
 * Verifica si un número telefónico, LID o cliente está en la lista blanca de la BD (contactos excluidos).
 * @param {string} cleanIdentifier - Identificador de chat (LID o Teléfono).
 * @param {string} [associatedPhone] - Teléfono asociado al cliente si ya fue resuelto.
 * @param {string} [clientId] - UUID del cliente si ya fue resuelto.
 * @returns {Promise<boolean>}
 */
async function isNumberInWhiteList(cleanIdentifier, associatedPhone = null, clientId = null) {
  if (!cleanIdentifier && !associatedPhone && !clientId) return false;
  try {
    const cleanId = (cleanIdentifier || '').replace(/\D/g, '');
    const cleanAssoc = (associatedPhone || '').replace(/\D/g, '');
    const last10Id = cleanId.length >= 10 ? cleanId.slice(-10) : '';
    const last10Assoc = cleanAssoc.length >= 10 ? cleanAssoc.slice(-10) : '';

    const { data, error } = await supabase
      .from('lista_blanca')
      .select('numero_whatsapp, nombre_contacto');

    if (error || !data || !Array.isArray(data)) return false;

    return data.some((row) => {
      const dbPhone = (row.numero_whatsapp || '').replace(/\D/g, '');
      if (!dbPhone) return false;
      const last10Db = dbPhone.length >= 10 ? dbPhone.slice(-10) : dbPhone;

      // 1. Coincidencia directa o por sufijos/prefijos (ej. 57300... vs 300...)
      if (cleanId && (cleanId === dbPhone || cleanId.endsWith(dbPhone) || dbPhone.endsWith(cleanId))) {
        return true;
      }
      if (last10Id && last10Db && last10Id === last10Db) {
        return true;
      }

      // 2. Coincidencia con el teléfono asociado reconciliado del cliente
      if (cleanAssoc && (cleanAssoc === dbPhone || cleanAssoc.endsWith(dbPhone) || dbPhone.endsWith(cleanAssoc))) {
        return true;
      }
      if (last10Assoc && last10Db && last10Assoc === last10Db) {
        return true;
      }

      return false;
    });
  } catch (err) {
    console.error('[BD] Error al verificar lista blanca:', err.message);
    return false;
  }
}

/**
 * Construye una URL de Google Maps a partir de una dirección.
 * @param {string} direccion
 * @returns {string} URL de Google Maps o vacío si no hay dirección.
 */
function buildGoogleMapsUrl(direccion) {
  if (!direccion || direccion.trim() === '') {
    return '';
  }

  const encoded = encodeURIComponent(direccion.trim());
  return `https://www.google.com/maps?q=${encoded}`;
}

/**
 * Construye el mensaje de ubicación de la empresa.
 * @param {object} empresa - Datos de la empresa.
 * @returns {string}
 */
function buildUbicacionMessage(empresa) {
  const lines = [];

  lines.push('📍 *Nuestra ubicación*');
  lines.push('');

  if (empresa?.direccion) {
    lines.push(empresa.direccion);
  } else {
    lines.push('Nuestra dirección está disponible en nuestro portal.');
  }

  const mapsUrl = buildGoogleMapsUrl(empresa?.direccion || '');
  if (mapsUrl) {
    lines.push('');
    lines.push('Encuéntranos en Google Maps aquí:');
    lines.push(mapsUrl);
  }

  return lines.join('\n');
}

/**
 * Construye el mensaje de horario de la empresa.
 * @param {object} empresa - Datos de la empresa.
 * @returns {string}
 */
function buildHorarioMessage(empresa) {
  const lines = [];

  lines.push('🕐 *Nuestro horario de atención*');
  lines.push('');

  if (empresa?.horario) {
    lines.push(empresa.horario);
  } else {
    lines.push('Lunes a Sabado: 9:00 AM – 7:00 PM');
  }

  lines.push('');
  lines.push('Fuera de este horario, responderemos tu mensaje a la brevedad. 😊');

  return lines.join('\n');
}

/**
 * Construye el mensaje de bienvenida con los datos de la empresa.
 * @param {object} empresa - Datos de la empresa.
 * @param {string} clientId - UUID del cliente para el link del portal.
 * @returns {string}
 */
function buildWelcomeMessage(empresa, clientId = '') {
  const nombreBot = empresa?.nom_bot || 'Mia';
  const lines = [];

  lines.push(`👋 *¡Bienvenido a ${empresa?.nombre || 'Nuestro Negocio'}!*`);
  lines.push('');
  lines.push(`Soy ${nombreBot}, tu asistente virtual. Estoy aquí para ayudarte con información sobre horarios, precios, ubicación y seguimiento de pedidos.`);
  lines.push('');
  lines.push('Si necesitas hablar con un asesor, escribe *agente* y te atenderemos pronto. 😊');
  lines.push('');

  // El enlace firmado funciona como credencial limitada del cliente.
  if (clientId) {
    const token = createBookingToken(clientId);
    if (token) {
      const url = new URL(PWA_URL);
      url.searchParams.set('id', clientId);
      url.searchParams.set('token', token);
      lines.push('Para consultar disponibilidad, agendar, cancelar o modificar tu cita en línea, ingresa a nuestro sitio web:');
      lines.push('');
      lines.push(`👉 ${url.toString()}`);
    } else {
      lines.push('Para recibir tu enlace seguro de reservas, escribe *agente* y te ayudaremos.');
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 3 · Lógica de resolución de respuesta (config.json + empresa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera FAQs dinámicas basadas en los datos de la empresa.
 * Se combinan con las FAQs estáticas de config.json.
 * @returns {Array<object>} Lista de FAQs.
 */
function getDynamicFaqs() {
  const faqs = [...(config.faqs || [])];

  // FAQ de horario (si la empresa tiene horario)
  if (empresaData?.horario) {
    faqs.unshift({
      id: 'horarios',
      keywords: [
        'horario',
        'horarios',
        'abren',
        'cierran',
        'atienden',
        'atencion',
        'cual es el horario',
        'cuando abren',
        'horario de atencion',
      ],
      message: buildHorarioMessage(empresaData),
      link: '',
    });
  }

  // FAQ de ubicación (si la empresa tiene dirección)
  if (empresaData?.direccion) {
    faqs.unshift({
      id: 'ubicacion',
      keywords: [
        'ubicacion',
        'ubicación',
        'direccion',
        'dirección',
        'donde',
        'dónde',
        'mapa',
        'ubicado',
        'donde estan',
        'capacidad',
        'lugar',
      ],
      message: buildUbicacionMessage(empresaData),
      link: '',
    });
  }

  return faqs;
}

/**
 * Busca la primera FAQ cuyas keywords coincidan con el texto normalizado.
 * @param {string} normalizedText
 * @returns {object|null} FAQ encontrada o `null`.
 */
function matchFaq(normalizedText) {
  const faqs = getDynamicFaqs();

  for (const faq of faqs) {
    const matched = (faq.keywords || []).some((kw) =>
      normalizedText.includes(normalizeText(kw))
    );
    if (matched) return faq;
  }
  return null;
}

/**
 * Construye el texto final del mensaje de respuesta.
 * Si la FAQ tiene link, lo agrega. Si es defaultSelfService, usa el link del PWA con el id del cliente.
 * @param {object|null} faq   - FAQ encontrada (puede ser null).
 * @param {string} clientId  - UUID del cliente para el link del portal.
 * @returns {string}          - Texto de respuesta.
 */
function buildResponseText(faq, clientId = '') {
  let bookingUrl = PWA_URL;
  if (clientId) {
    const token = createBookingToken(clientId);
    if (token) {
      const url = new URL(PWA_URL);
      url.searchParams.set('id', clientId);
      url.searchParams.set('token', token);
      bookingUrl = url.toString();
    }
  }

  if (faq) {
    let text = faq.message || '';

    // Reemplazar enlaces al portal sin ID por el enlace con ID y token del cliente
    text = text.replace(/https?:\/\/[^\s]*angelnails[^\s]*\/reservar(?!\?id=)/gi, bookingUrl);

    // Si la FAQ tiene un link propio (ej: precios, pedidos), agregar
    if (faq.link) {
      let faqLink = faq.link;
      if (faqLink.includes('/reservar') && !faqLink.includes('?id=')) {
        faqLink = bookingUrl;
      }
      text += `\n\n${faqLink}`;
    }

    return text;
  }

  // Default: mensajes de bienvenida con datos de la empresa + link al PWA
  return buildWelcomeMessage(empresaData, clientId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 4 · Operaciones con la base de datos (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga los datos de la empresa desde la BD.
 * @returns {Promise<object | null>}
 */
async function loadEmpresaData() {
  try {
    const { data, error } = await supabase
      .from('empresa')
      .select('*')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID)
      .limit(1);

    if (error) {
      console.error('[BD] Error al cargar datos de empresa:', error.message);
      return null;
    }

    if (data && data.length > 0) {
      empresaData = data[0];
      console.log(`[BD] Datos de empresa cargados: ${empresaData.nombre}`);
      return empresaData;
    }

    console.warn('[BD] No se encontraron datos en tabla empresa.');
    return null;
  } catch (err) {
    console.error('[BD] Error inesperado en loadEmpresaData:', err.message);
    return null;
  }
}

/**
 * Busca o reconcilia un cliente por teléfono, LID o ID explícito usando la RPC atómica.
 * @param {string} identifier - Número o LID limpio (solo dígitos).
 * @param {string} pushName   - Nombre del cliente desde Evolution (opcional).
 * @param {boolean} isLid      - Si el identificador es un LID.
 * @param {string} explicitPhone - Teléfono explícito enviado si se conoce.
 * @param {string} explicitClientId - UUID del cliente si viene de token/URL.
 * @returns {Promise<{ id: string, nombre?: string, numero?: string, lid?: string } | null>}
 */
async function findOrCreateClient(identifier, pushName = '', isLid = false, explicitPhone = null, explicitClientId = null) {
  try {
    const cleanId = (identifier || '').replace(/\D/g, '');
    const cleanPhone = (explicitPhone || '').replace(/\D/g, '');

    // Clasificación estricta:
    // Teléfono: <= 12 dígitos (ej: 573245631084 o 3007256149)
    // LID de Meta: >= 14 dígitos (ej: 268225153638543)
    let phoneToUse = cleanPhone || (!isLid && cleanId.length <= 12 ? cleanId : null);
    let lidToUse = isLid || cleanId.length >= 14 ? cleanId : null;

    // Normalizar teléfono colombiano
    if (phoneToUse && phoneToUse.length === 10 && phoneToUse.startsWith('3')) {
      phoneToUse = `57${phoneToUse}`;
    }

    const nombreFinal = pushName && pushName.trim() ? pushName.trim() : 'Cliente';

    // 1. Invocar RPC atómica en Supabase
    const { data: rpcClient, error: rpcError } = await supabase.rpc('reconciliar_o_crear_cliente', {
      p_id: explicitClientId || null,
      p_nombre: nombreFinal,
      p_telefono: phoneToUse,
      p_lid: lidToUse,
    });

    if (!rpcError && rpcClient) {
      return rpcClient;
    }

    if (rpcError) {
      console.warn('[BD] RPC reconciliar_o_crear_cliente aviso:', rpcError.message);
    }

    // 2. Fallback de consulta directa
    let fallbackQuery = supabase.from('clientes').select('id, nombre, numero, lid');
    if (explicitClientId) {
      fallbackQuery = fallbackQuery.eq('id', explicitClientId);
    } else if (phoneToUse) {
      fallbackQuery = fallbackQuery.eq('numero', phoneToUse);
    } else if (lidToUse) {
      fallbackQuery = fallbackQuery.eq('lid', lidToUse);
    }

    const { data: fallbackData } = await fallbackQuery.maybeSingle();
    if (fallbackData) return fallbackData;

    return null;
  } catch (err) {
    console.error('[BD] Error inesperado en findOrCreateClient:', err.message);
    return null;
  }
}

/**
 * Obtiene la configuración de bot desde la BD.
 * @returns {Promise<{ botActivo: boolean, telefonoProfesional: string } | null>}
 */
async function getBotConfigFromDB() {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID)
      .in('clave', ['bot_activo', 'telefono_profesional']);

    if (error) {
      console.error('[BD] Error al leer configuración:', error.message);
      return null;
    }

    const configMap = {};
    if (data) {
      for (const row of data) {
        configMap[row.clave] = row.valor;
      }
    }

    const botActivo = configMap['bot_activo'] === true ||
                      configMap['bot_activo'] === 'true' ||
                      configMap['bot_activo'] === '1' ||
                      configMap['bot_activo'] === 1;

    return {
      botActivo,
      telefonoProfesional: configMap['telefono_profesional'] || '',
    };
  } catch (err) {
    console.error('[BD] Error inesperado en getBotConfigFromDB:', err.message);
    return null;
  }
}

/**
 * Plantillas por defecto para fallback del backend
 */
const PLANTILLAS_DEFECTO_BACKEND = {
  confirmacion: {
    titulo: '✨ CITA CONFIRMADA EXITOSAMENTE',
    cuerpo: 'Hola {nombre_cliente}, ¡tu reserva ha sido agendada con éxito en {nombre_empresa}!\n\n💅 *Servicio:* {servicio}\n📅 *Fecha:* {fecha_cita}\n⏰ *Hora:* {hora_cita}\n📍 *Ubicación:* {direccion_empresa}\n\nEstamos muy entusiasmados por atenderte.',
    accion: 'Si necesitas modificar o reprogramar tu cita, responde a este mensaje o ingresa a {link_reserva}.',
    activa: true,
  },
  recordatorio: {
    titulo: '⏰ RECORDATORIO DE TU PRÓXIMA CITA',
    cuerpo: 'Hola {nombre_cliente}, queremos recordarte que tienes una cita programada para mañana en {nombre_empresa}.\n\n✨ *Servicio:* {servicio}\n📅 *Fecha:* {fecha_cita}\n⏰ *Hora:* {hora_cita}',
    accion: 'Por favor responde *1* para CONFIRMAR tu asistencia o *2* si deseas REPROGRAMAR.',
    activa: true,
  },
  cancelacion: {
    titulo: '❌ CITA CANCELADA',
    cuerpo: 'Hola {nombre_cliente}, confirmamos que tu cita para el servicio de {servicio} programada el {fecha_cita} a las {hora_cita} ha sido cancelada.',
    accion: 'Si deseas agendar un nuevo espacio, puedes volver a reservar aquí: {link_reserva}',
    activa: true,
  },
  seguimiento: {
    titulo: '💜 ¡GRACIAS POR TU VISITA!',
    cuerpo: 'Hola {nombre_cliente}, esperamos que hayas quedado feliz con tu servicio de {servicio} en {nombre_empresa}.\n\nPara nosotros tu opinión es extremadamente valiosa.',
    accion: 'Cuéntanos del 1 al 5 qué tal te pareció la atención hoy. ¡Que tengas un día radiante! 🌟',
    activa: true,
  },
  promocion: {
    titulo: '🎉 ¡TENEMOS UNA SORPRESA PARA TI!',
    cuerpo: 'Hola {nombre_cliente}, queremos invitarte a conocer nuestras nuevas tendencias y promociones exclusivas del mes en {nombre_empresa}.',
    accion: '¡Agenda hoy mismo tu cita con descuento aquí! 👉 {link_reserva}',
    activa: true,
  }
};

/**
 * Obtiene las plantillas personalizadas de WhatsApp desde Supabase
 */
async function getPlantillasFromDB(userId = WHATSAPP_ADMIN_USER_ID) {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('user_id', userId || WHATSAPP_ADMIN_USER_ID)
      .eq('clave', 'wa_plantillas_mensajes_v1')
      .maybeSingle();

    if (error || !data || !data.valor) {
      return PLANTILLAS_DEFECTO_BACKEND;
    }

    const parsed = JSON.parse(data.valor);
    return {
      ...PLANTILLAS_DEFECTO_BACKEND,
      ...parsed,
    };
  } catch (err) {
    console.error('[BD] Error al leer plantillas de WhatsApp:', err.message);
    return PLANTILLAS_DEFECTO_BACKEND;
  }
}



/**
 * Formatea una plantilla reemplazando variables dinámicas en Título, Cuerpo y Acción.
 */
function formatPlantillaMensaje(plantilla, datos = {}) {
  if (!plantilla) return '';

  let bookingLink = datos.link_reserva || '';
  const clientId = datos.cliente_id || datos.id || datos.idCliente;

  if (clientId) {
    const token = createBookingToken(clientId);
    if (token) {
      const url = new URL(PWA_URL);
      url.searchParams.set('id', clientId);
      url.searchParams.set('token', token);
      bookingLink = url.toString();
    }
  }

  if (!bookingLink || !bookingLink.includes('?id=')) {
    if (clientId) {
      const token = createBookingToken(clientId);
      if (token) {
        const url = new URL(PWA_URL);
        url.searchParams.set('id', clientId);
        url.searchParams.set('token', token);
        bookingLink = url.toString();
      }
    }
  }

  if (!bookingLink) {
    bookingLink = PWA_URL;
  }

  const sustitutos = {
    '{nombre_cliente}': datos.nombre_cliente || datos.cliente_nombre || 'Cliente',
    '{servicio}': datos.servicio || datos.servicio_nombre || 'Servicio',
    '{fecha_cita}': datos.fecha_cita || datos.fecha || '',
    '{hora_cita}': datos.hora_cita || datos.hora || '',
    '{nombre_empresa}': datos.nombre_empresa || datos.empresa || empresaData?.nombre || 'Angel Nails Studio',
    '{direccion_empresa}': datos.direccion_empresa || datos.direccion || empresaData?.direccion || '',
    '{link_reserva}': bookingLink,
  };

  const reemplazar = (texto) => {
    let res = texto || '';
    Object.entries(sustitutos).forEach(([k, v]) => {
      res = res.split(k).join(v);
    });
    // Forzar el reemplazo de cualquier URL genérica /reservar sin parámetro ?id= por la URL firmada
    if (bookingLink && bookingLink.includes('?id=')) {
      res = res.replace(/https?:\/\/[^\s]*\/reservar(?!\?id=)/gi, bookingLink);
    }
    return res;
  };

  const tituloProc = reemplazar(plantilla.titulo).trim();
  const cuerpoProc = reemplazar(plantilla.cuerpo).trim();
  const accionProc = reemplazar(plantilla.accion).trim();

  let mensajeFinal = '';
  if (tituloProc) mensajeFinal += `*${tituloProc}*\n\n`;
  if (cuerpoProc) mensajeFinal += `${cuerpoProc}\n`;
  if (accionProc) mensajeFinal += `\n─────────────────────\n*👉 Acción / Respuesta:* ${accionProc}`;

  return mensajeFinal.trim();
}

/**
 * Actualiza el estado de conversación para un cliente tanto en BD como en memoria.
 * @param {string} clientId    - UUID del cliente.
 * @param {string} nuevoEstado - Nuevo estado ('HUMANO', 'MENU_PRINCIPAL', etc.).
 * @param {string} [telefono]  - Identificador de chat o teléfono.
 * @returns {Promise<boolean>}
 */
async function updateConversationState(clientId, nuevoEstado, telefono = null) {
  if (!clientId && !telefono) return false;
  const now = Date.now();
  const cleanTel = telefono ? telefono.replace(/\D/g, '') : null;

  // 1. Actualizar caché en memoria con múltiples llaves para detección instantánea
  if (nuevoEstado === 'HUMANO') {
    if (clientId) humanStateCache.set(clientId, now);
    if (cleanTel) humanStateCache.set(cleanTel, now);
  } else {
    if (clientId) humanStateCache.delete(clientId);
    if (cleanTel) humanStateCache.delete(cleanTel);
  }

  // 2. Invocar RPC en Supabase
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('actualizar_o_crear_conversacion_estado', {
      p_cliente_id: clientId || null,
      p_telefono: cleanTel || null,
      p_nuevo_estado: nuevoEstado,
    });

    if (!rpcError && rpcData) {
      console.log(`[CONV STATE] Estado actualizado a ${nuevoEstado} (BD) para cliente=${clientId}, tel=${cleanTel}`);
      return true;
    }

    if (rpcError) {
      console.warn('[CONV STATE] RPC aviso, ejecutando fallback:', rpcError.message);
    }
  } catch (err) {
    console.warn('[CONV STATE] Error llamando a RPC:', err.message);
  }

  // 3. Fallback directo sobre la tabla conversacion_estado
  try {
    let query = supabase.from('conversacion_estado').select('id');
    if (clientId) {
      query = query.eq('cliente_id', clientId);
    } else if (cleanTel) {
      query = query.eq('telefono', cleanTel);
    }

    const { data: existente } = await query.limit(1).maybeSingle();

    if (existente?.id) {
      await supabase
        .from('conversacion_estado')
        .update({
          estado: nuevoEstado,
          updated_at: new Date().toISOString(),
          ...(cleanTel ? { telefono: cleanTel } : {}),
        })
        .eq('id', existente.id);
      return true;
    }

    await supabase.from('conversacion_estado').insert({
      cliente_id: clientId || null,
      telefono: cleanTel || clientId,
      estado: nuevoEstado,
      updated_at: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('[CONV STATE] Error inesperado en fallback:', err.message);
    return false;
  }
}

/**
 * Verifica si un cliente/chat está en estado HUMANO, validando expiración de inactividad (2 horas).
 * @param {string} clientId - UUID del cliente.
 * @param {string} [cleanIdentifier] - JID/LID/Teléfono del chat.
 * @param {string} [clientPhone] - Teléfono registrado del cliente.
 * @returns {Promise<boolean>}
 */
async function isClientInHumanState(clientId, cleanIdentifier = null, clientPhone = null) {
  const now = Date.now();
  const cleanId = (cleanIdentifier || '').replace(/\D/g, '');
  const cleanPh = (clientPhone || '').replace(/\D/g, '');

  // 0. Si está en lista blanca, NUNCA expira: siempre está en atención humana / excluido del bot
  const whitelisted = await isNumberInWhiteList(cleanId, cleanPh, clientId);
  if (whitelisted) {
    return true;
  }

  // 1. Verificar en caché en memoria por cualquiera de las llaves asociadas
  const cachedTs = (clientId && humanStateCache.get(clientId)) ||
                   (cleanId && humanStateCache.get(cleanId)) ||
                   (cleanPh && humanStateCache.get(cleanPh));

  if (cachedTs) {
    if (now - cachedTs < HUMAN_STATE_EXPIRATION_MS) {
      return true;
    } else {
      console.log(`[BOT] Expiró el periodo de atención humana para ${clientId || cleanId}. Reactivando bot.`);
      if (clientId) humanStateCache.delete(clientId);
      if (cleanId) humanStateCache.delete(cleanId);
      if (cleanPh) humanStateCache.delete(cleanPh);
      await updateConversationState(clientId, 'MENU_PRINCIPAL', cleanId || cleanPh);
      return false;
    }
  }

  // 2. Si no está en memoria, consultar Supabase
  try {
    let query = supabase.from('conversacion_estado').select('estado, updated_at');
    if (clientId) {
      query = query.or(`cliente_id.eq.${clientId},telefono.eq.${cleanId || ''},telefono.eq.${cleanPh || ''}`);
    } else if (cleanId) {
      query = query.eq('telefono', cleanId);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) return false;

    if (data.estado === 'HUMANO') {
      const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : now;
      if (now - updatedAt < HUMAN_STATE_EXPIRATION_MS) {
        if (clientId) humanStateCache.set(clientId, updatedAt);
        if (cleanId) humanStateCache.set(cleanId, updatedAt);
        if (cleanPh) humanStateCache.set(cleanPh, updatedAt);
        return true;
      } else {
        console.log(`[BOT] Expiró el periodo de atención humana (BD) para ${clientId || cleanId}.`);
        await updateConversationState(clientId, 'MENU_PRINCIPAL', cleanId || cleanPh);
        return false;
      }
    }

    return false;
  } catch (err) {
    console.error('[BD] Error inesperado en isClientInHumanState:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 5 · Integración con Evolution API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Espera un tiempo aleatorio entre 2 y 6 segundos y simula presencia de escritura.
 * @param {string} to - JID del destinatario.
 * @returns {Promise<void>}
 */
async function simulateTyping(to) {
  // Delay aleatorio entre 2000 y 6000 ms
  const delay = Math.floor(Math.random() * (6000 - 2000 + 1)) + 2000;

  console.log('[TYPING] Simulando presencia de escritura.');

  // Enviar presence "typing" para que el cliente vea que alguien está escribiendo
  try {
    const typingUrl = `${EVOLUTION_API_URL}/presence/${EVOLUTION_INSTANCE}`;
    await axios.post(typingUrl, {
      number: to,
      typing: true,
    }, {
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      timeout: 5000,
    });
  } catch (err) {
    console.warn('[TYPING] No se pudo enviar presence typing.');
  }

  // Esperar el delay aleatorio
  await new Promise((resolve) => setTimeout(resolve, delay));

  console.log(`[TYPING] Escritura simulada por ${delay}ms.`);
}

/**
 * Envía un mensaje de texto a través de Evolution API.
 *
 * @param {string} to      - JID canónico del destinatario.
 * @param {string} text    - Texto a enviar.
 * @param {boolean} preview - Si se debe generar vista previa de enlaces.
 * @returns {Promise<void>}
 */
async function sendEvolutionMessage(to, text, preview = false) {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const payload = {
    number: to,
    text: text,
    options: {
      delay: 0,        // Sin delay adicional, ya tenemos simulateTyping
      presence: 'recording', // Evitar mensaje de "composing" después del envío
      linkPreview: preview,
    },
  };

  await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_API_KEY,
    },
    timeout: 10_000,
  });
}

/**
 * Envía un mensaje con simulación de escritura antes de enviar.
 * @param {string} to      - JID canónico del destinatario.
 * @param {string} text    - Texto a enviar.
 * @param {boolean} preview - Si se debe generar vista previa de enlaces.
 * @returns {Promise<void>}
 */
async function sendMessageWithTyping(to, text, preview = false) {
  // 1. Simular escritura (2-6 segundos)
  await simulateTyping(to);

  // 2. Enviar el mensaje
  await sendEvolutionMessage(to, text, preview);
}

/**
 * Notifica al profesional cuando un cliente solicita atención humana.
 * @param {string} telefonoProfesional - Número limpio del profesional.
 * @param {string} clientJid           - JID del cliente que solicitó.
 * @param {string} clientMessage       - Mensaje del cliente.
 * @returns {Promise<void>}
 */
async function notifyProfessional(telefonoProfesional, clientJid, clientMessage) {
  const message =
    '⚠️ *SOLICITUD DE ASESOR HUMANO*\n\n' +
    'Un cliente solicita atención:\n' +
    `📱 *Cliente:* ${clientJid}\n` +
    `💬 *Mensaje:* "${clientMessage}"`;

  await sendMessageWithTyping(telefonoProfesional, message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 6 · Middleware de autenticación para la API de administración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware que valida la cabecera `x-api-key` contra `ADMIN_API_KEY`.
 */
function requireAdminKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!ADMIN_API_KEY) {
    return res.status(503).json({
      error: 'ADMIN_API_KEY no está configurada en el servidor.',
    });
  }
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'No autorizado. x-api-key inválida.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 7 · Configuración del servidor Express
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.use((req, res, next) => {
  const origin = req.get('Origin');

  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey, x-api-key, Cache-Control, Pragma, X-Requested-With');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Max-Age', '86400');
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json());

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function requireBusinessOwner(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !WHATSAPP_ADMIN_USER_ID) {
    return res.status(503).json({ error: 'Falta configurar el acceso administrativo de WhatsApp.' });
  }

  const accessToken = req.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return res.status(401).json({ error: 'Sesión requerida.' });

  try {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    if (data.user.id !== WHATSAPP_ADMIN_USER_ID) {
      return res.status(403).json({ error: 'No tienes permiso para administrar WhatsApp.' });
    }
    next();
  } catch (error) {
    console.error('[AUTH] No se pudo validar la sesión:', error.message);
    return res.status(503).json({ error: 'No se pudo validar la sesión.' });
  }
}

function requireEvolutionWebhook(req, res, next) {
  if (!EVOLUTION_WEBHOOK_SECRET || EVOLUTION_WEBHOOK_SECRET.length < 32) {
    return res.status(503).json({ error: 'La autenticación del webhook no está configurada.' });
  }

  const token = req.get('Authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!verifyEvolutionWebhookToken(token, EVOLUTION_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Firma de webhook inválida.' });
  }

  next();
}

async function proxyEvolution(res, method, endpoint, payload, mapResponse = (data) => data) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(503).json({ error: 'Evolution API no está configurada en el servidor.' });
  }

  try {
    const response = await axios.request({
      method,
      url: `${EVOLUTION_API_URL.replace(/\/$/, '')}${endpoint}`,
      headers: { apikey: EVOLUTION_API_KEY },
      data: payload,
      timeout: 10_000,
    });
    return res.status(response.status).json(mapResponse(response.data));
  } catch (error) {
    const status = error.response?.status || 502;
    console.error(`[EVOLUTION] Error en ${method} ${endpoint}: HTTP ${status}`);
    return res.status(status).json({ error: 'No se pudo completar la operación de WhatsApp.' });
  }
}

const evolutionInstance = encodeURIComponent(EVOLUTION_INSTANCE);
app.post('/api/evolution/instance/create', requireBusinessOwner, (req, res) => {
  if (!EVOLUTION_WEBHOOK_SECRET || EVOLUTION_WEBHOOK_SECRET.length < 32) {
    return res.status(503).json({ error: 'La autenticación del webhook no está configurada.' });
  }

  return proxyEvolution(res, 'POST', '/instance/create', {
    instanceName: EVOLUTION_INSTANCE,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
    webhook: {
      enabled: true,
      url: EVOLUTION_WEBHOOK_URL,
      headers: { jwt_key: EVOLUTION_WEBHOOK_SECRET },
      byEvents: false,
      base64: false,
      events: ['MESSAGES_UPSERT'],
    },
  }, (data) => ({ instance: data.instance }))
});
app.get('/api/evolution/instance/connect', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'GET', `/instance/connect/${evolutionInstance}`)
);
app.get('/api/evolution/instance/connection-state', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'GET', `/instance/connectionState/${evolutionInstance}`)
);
app.get('/api/evolution/instances', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'GET', `/instance/fetchInstances?instanceName=${evolutionInstance}`)
);
app.put('/api/evolution/instance/restart', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'PUT', `/instance/restart/${evolutionInstance}`)
);
app.delete('/api/evolution/instance/logout', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'DELETE', `/instance/logout/${evolutionInstance}`)
);
app.delete('/api/evolution/instance/delete', requireBusinessOwner, (req, res) =>
  proxyEvolution(res, 'DELETE', `/instance/delete/${evolutionInstance}`)
);

function requireBookingAccess(req, res, next) {
  if (!SUPABASE_SERVICE_ROLE_KEY || !BOOKING_LINK_SECRET || !WHATSAPP_ADMIN_USER_ID) {
    return res.status(503).json({ error: 'El acceso seguro a reservas no está configurado.' });
  }

  const token = req.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = verifyBookingToken(token);
  if (!claims || !/^[0-9a-f-]{36}$/i.test(claims.sub)) {
    return res.status(401).json({ error: 'El enlace de reserva no es válido o expiró.' });
  }

  req.bookingClientId = claims.sub;
  next();
}

function isValidBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function timeToMinutes(value) {
  const [hours, minutes] = (value || '').split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

const ACTIVE_APPOINTMENT_STATES = new Set(['AGENDADO', 'AGENDADA', 'PENDIENTE', 'EN_ESPERA']);

async function getBookingSlots(date, serviceId, clientId, excludeAppointmentId = '') {
  if (!isValidBookingDate(date) || !/^[0-9a-f-]{36}$/i.test(serviceId || '')) {
    return { error: 'Fecha o servicio inválido.' };
  }

  // Calcular fecha y hora actual en zona horaria de Colombia (America/Bogota)
  const now = new Date();
  const bogotaDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now);

  // Si la fecha solicitada es anterior a hoy, no hay horarios disponibles
  if (date < bogotaDateStr) {
    return { slots: [] };
  }

  const isToday = (date === bogotaDateStr);
  let minStartMinutes = -1;

  if (isToday) {
    const bogotaTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const [nowH, nowM] = bogotaTimeStr.split(':').map(Number);
    // Exigir al menos 15 minutos de anticipación mínima para agendar hoy
    minStartMinutes = (nowH * 60) + (nowM || 0) + 15;
  }

  const { data: service, error: serviceError } = await supabase
    .from('servicios')
    .select('duracion_minutos')
    .eq('id', serviceId)
    .eq('user_id', WHATSAPP_ADMIN_USER_ID)
    .eq('activo', true)
    .maybeSingle();
  if (serviceError) return { databaseError: serviceError };
  if (!service || !Number.isInteger(service.duracion_minutos) || service.duracion_minutos <= 0) {
    return { error: 'Servicio no disponible.' };
  }

  if (excludeAppointmentId) {
    const { data: appointment, error } = await supabase
      .from('citas')
      .select('id, estado')
      .eq('id', excludeAppointmentId)
      .eq('cliente_id', clientId)
      .eq('user_id', WHATSAPP_ADMIN_USER_ID)
      .maybeSingle();
    if (error) return { databaseError: error };
    if (!appointment || !ACTIVE_APPOINTMENT_STATES.has(appointment.estado?.toUpperCase())) {
      return { error: 'La cita seleccionada no pertenece a este enlace o no está activa.' };
    }
  }

  const [scheduleResult, blocksResult, appointmentsResult] = await Promise.all([
    supabase.from('horario_atencion').select('hora_inicio, hora_fin, activo')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID).eq('fecha', date).maybeSingle(),
    supabase.from('bloqueos_agenda').select('hora_inicio, hora_fin, bloqueo_completo')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID).eq('fecha', date),
    supabase.from('citas').select('id, hora_inicio, hora_fin, estado')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID).eq('fecha_inicio', date),
  ]);

  const queryError = scheduleResult.error || blocksResult.error || appointmentsResult.error;
  if (queryError) return { databaseError: queryError };

  // Si el día está marcado como no activo o no está configurado, no hay slots
  if (!scheduleResult.data || scheduleResult.data.activo === false) {
    return { slots: [] };
  }

  const blocks = blocksResult.data || [];
  // Si todo el día está bloqueado por la agenda, no hay slots
  if (blocks.some((b) => b.bloqueo_completo)) {
    return { slots: [] };
  }

  const opening = timeToMinutes(scheduleResult.data.hora_inicio);
  const closing = timeToMinutes(scheduleResult.data.hora_fin);
  const duration = service.duracion_minutos;
  const appointments = (appointmentsResult.data || []).filter((appointment) =>
    appointment.id !== excludeAppointmentId && ACTIVE_APPOINTMENT_STATES.has(appointment.estado?.toUpperCase())
  );
  const slots = [];

  for (let start = opening; start + duration <= closing; start += duration) {
    // Si la fecha es HOY y la hora ya pasó (o falta menos de 15m), descartar
    if (isToday && start < minStartMinutes) {
      continue;
    }

    const end = start + duration;
    const blocked = blocks.some((block) => block.bloqueo_completo ||
      (start < timeToMinutes(block.hora_fin) && end > timeToMinutes(block.hora_inicio)));
    const occupied = appointments.some((appointment) =>
      start < timeToMinutes(appointment.hora_fin) && end > timeToMinutes(appointment.hora_inicio)
    );
    if (!blocked && !occupied) slots.push(minutesToTime(start));
  }

  return { slots };
}

app.post('/api/booking/identify', asyncRoute(async (req, res) => {
  const { phone, name } = req.body || {};
  const cleanPhone = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
    return res.status(400).json({ error: 'Ingresa un número de WhatsApp válido.' });
  }

  const clientInfo = await findOrCreateClient(cleanPhone, name || '');
  if (!clientInfo || !clientInfo.id) {
    return res.status(503).json({ error: 'No se pudo identificar o registrar tu cuenta.' });
  }

  const token = createBookingToken(clientInfo.id);
  if (!token) {
    return res.status(503).json({ error: 'Error al generar el acceso seguro.' });
  }

  return res.json({
    id: clientInfo.id,
    token: token,
    nombre: name || '',
    telefono: cleanPhone,
  });
}));

app.get('/api/booking/availability', requireBookingAccess, asyncRoute(async (req, res) => {
  const result = await getBookingSlots(req.query.date, req.query.serviceId, req.bookingClientId, req.query.excludeAppointmentId);
  if (result.databaseError) return res.status(503).json({ error: 'No se pudo consultar la disponibilidad.' });
  if (result.error) return res.status(400).json({ error: result.error });
  return res.json({ slots: result.slots });
}));

app.get('/api/booking/public-info', asyncRoute(async (_req, res) => {
  await loadEmpresaData();
  const botConfig = await getBotConfigFromDB();
  return res.json({
    company: empresaData ? {
      nombre: empresaData.nombre,
      direccion: empresaData.direccion,
      horario: empresaData.horario,
      politicas: empresaData.politicas,
      nom_bot: empresaData.nom_bot,
      logo_url: empresaData.logo_url,
      color_primario: empresaData.color_primario,
      color_secundario: empresaData.color_secundario,
    } : null,
    professionalPhone: botConfig?.telefonoProfesional || null,
  });
}));

app.get('/api/booking/context', requireBookingAccess, asyncRoute(async (req, res) => {
  await loadEmpresaData();
  const botConfig = await getBotConfigFromDB();
  if (!botConfig) {
    return res.status(503).json({ error: 'No se pudo cargar la configuración del negocio.' });
  }

  let clientInfo = null;
  if (req.bookingClientId) {
    const { data } = await supabase.from('clientes')
      .select('id, nombre, numero, lid')
      .eq('id', req.bookingClientId)
      .maybeSingle();
    if (data) clientInfo = data;
  }

  return res.json({
    company: empresaData ? {
      nombre: empresaData.nombre,
      direccion: empresaData.direccion,
      horario: empresaData.horario,
      politicas: empresaData.politicas,
      nom_bot: empresaData.nom_bot,
    } : null,
    professionalPhone: botConfig?.telefonoProfesional || null,
    client: clientInfo ? {
      id: clientInfo.id,
      nombre: clientInfo.nombre,
      telefono: clientInfo.numero || '',
      numero: clientInfo.numero || '',
      lid: clientInfo.lid || null,
    } : null,
  });
}));

app.get('/api/booking/appointments', requireBookingAccess, asyncRoute(async (req, res) => {
  const { data, error } = await supabase.from('citas').select(`
    *,
    servicios ( id, nombre, valor, duracion_minutos )
  `)
    .eq('user_id', WHATSAPP_ADMIN_USER_ID)
    .eq('cliente_id', req.bookingClientId)
    .order('fecha_inicio', { ascending: false })
    .order('hora_inicio', { ascending: false })
    .limit(100);
  if (error) return res.status(503).json({ error: 'No se pudieron consultar tus citas.' });

  const appointments = req.query.active === 'true'
    ? (data || []).filter((appointment) => ACTIVE_APPOINTMENT_STATES.has(appointment.estado?.toUpperCase()))
    : data || [];
  return res.json({ appointments });
}));

app.post('/api/booking/appointments', requireBookingAccess, asyncRoute(async (req, res) => {
  const { serviceId, date, startTime, name, phone } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(serviceId || '') || !isValidBookingDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') ||
      typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof phone !== 'string' || !phone.trim() || phone.trim().length > 32) {
    return res.status(400).json({ error: 'Completa los datos de la reserva.' });
  }

  // 1. Sincronizar o crear el cliente para asegurar datos consistentes
  const cleanPhone = phone.trim().replace(/\D/g, '');
  const fullPhone = (cleanPhone.length === 10 && cleanPhone.startsWith('3')) ? `57${cleanPhone}` : cleanPhone;
  const synchronizedClient = await findOrCreateClient(fullPhone, name.trim(), false, fullPhone, req.bookingClientId);
  const effectiveClientId = synchronizedClient?.id || req.bookingClientId;

  // 2. Insertar cita segura
  const { data, error } = await supabase.rpc('reservar_cita_segura', {
    p_user_id: WHATSAPP_ADMIN_USER_ID,
    p_servicio_id: serviceId,
    p_cliente_id: effectiveClientId,
    p_cliente_nombre: name.trim(),
    p_cliente_numero: fullPhone,
    p_fecha: date,
    p_hora_inicio: startTime,
  });

  if (error) {
    console.error('[Booking Error] Error en RPC reservar_cita_segura:', error);
    let status = 503;
    let message = error.message || 'No se pudo guardar la cita.';

    if (error.code === 'P0001') {
      status = 409;
    } else if (error.code === 'PGRST202') {
      status = 503;
      message = 'Error de servidor: La función "reservar_cita_segura" no está instalada en Supabase (migración pendiente).';
    }

    return res.status(status).json({ error: message, details: error.details || null });
  }

  // 3. Disparar notificaciones WhatsApp en segundo plano
  (async () => {
    try {
      const { data: servicioData } = await supabase.from('servicios').select('nombre').eq('id', serviceId).maybeSingle();
      const servicioNombre = servicioData?.nombre || 'Servicio';

      const plantillas = await getPlantillasFromDB(WHATSAPP_ADMIN_USER_ID);
      const plantillaTarget = plantillas.confirmacion;

      if (plantillaTarget && fullPhone) {
        const messageText = formatPlantillaMensaje(plantillaTarget, {
          cliente_id: effectiveClientId,
          nombre_cliente: name.trim(),
          telefono_cliente: fullPhone,
          servicio: servicioNombre,
          fecha_cita: date,
          hora_cita: startTime,
        });

        const recipient = `${fullPhone}@s.whatsapp.net`;
        await sendEvolutionMessage(recipient, messageText, true);
        console.log(`[BOOKING] Mensaje de confirmación enviado por WhatsApp a ${fullPhone}`);
      }

      const botConfig = await getBotConfigFromDB();
      if (botConfig?.telefonoProfesional) {
        const adminMsg = `📅 *¡Nueva cita agendada online!*\n\n👤 *Clienta:* ${name.trim()}\n📱 *Teléfono:* ${fullPhone}\n💅 *Servicio:* ${servicioNombre}\n🗓️ *Fecha:* ${date}\n⏰ *Hora:* ${startTime}`;
        const adminRecipient = `${botConfig.telefonoProfesional.replace(/\D/g, '')}@s.whatsapp.net`;
        await sendEvolutionMessage(adminRecipient, adminMsg, false);
      }
    } catch (notifyErr) {
      console.error('[BOOKING] Error enviando WhatsApp de confirmación:', notifyErr?.message || notifyErr);
    }
  })();

  return res.status(201).json({ appointment: data });
}));

app.post('/api/booking/appointments/:id/cancel', requireBookingAccess, asyncRoute(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Cita inválida.' });

  const query = supabase.from('citas').select('*, servicios(nombre)')
    .eq('id', req.params.id)
    .eq('user_id', WHATSAPP_ADMIN_USER_ID)
    .eq('cliente_id', req.bookingClientId);
  const { data: cita, error: readError } = await query.maybeSingle();
  if (readError) {
    console.error('[Booking Error] Error al consultar cita para cancelar:', readError);
    return res.status(503).json({ error: readError.message || 'No se pudo consultar la cita.' });
  }
  if (!cita || !ACTIVE_APPOINTMENT_STATES.has(cita.estado?.toUpperCase())) {
    return res.status(404).json({ error: 'No se encontró una cita activa para este enlace.' });
  }

  const { data, error } = await supabase.from('citas')
    .update({ estado: 'CANCELADO_CLIENTE' })
    .eq('id', req.params.id)
    .eq('user_id', WHATSAPP_ADMIN_USER_ID)
    .eq('cliente_id', req.bookingClientId)
    .eq('estado', cita.estado)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[Booking Error] Error al cancelar cita:', error);
    return res.status(503).json({ error: error.message || 'No se pudo cancelar la cita.' });
  }
  if (!data) return res.status(409).json({ error: 'La cita cambió de estado; actualiza e intenta de nuevo.' });

  // Notificar cancelación por WhatsApp
  (async () => {
    try {
      const cleanNum = (cita.cliente_numero || '').replace(/\D/g, '');
      if (cleanNum) {
        const plantillas = await getPlantillasFromDB(WHATSAPP_ADMIN_USER_ID);
        const plantillaTarget = plantillas.cancelacion;
        if (plantillaTarget) {
          const msg = formatPlantillaMensaje(plantillaTarget, {
            cliente_id: cita.cliente_id,
            nombre_cliente: cita.cliente_nombre || 'Clienta',
            servicio: cita.servicios?.nombre || 'Servicio',
            fecha_cita: cita.fecha_inicio,
            hora_cita: cita.hora_inicio,
          });
          await sendEvolutionMessage(`${cleanNum}@s.whatsapp.net`, msg, true);
        }
      }
      const botConfig = await getBotConfigFromDB();
      if (botConfig?.telefonoProfesional) {
        const adminMsg = `❌ *Cita Cancelada por la Clienta*\n\n👤 *Clienta:* ${cita.cliente_nombre}\n📱 *Tel:* ${cita.cliente_numero}\n🗓️ *Fecha:* ${cita.fecha_inicio} a las ${cita.hora_inicio}`;
        await sendEvolutionMessage(`${botConfig.telefonoProfesional.replace(/\D/g, '')}@s.whatsapp.net`, adminMsg, false);
      }
    } catch (e) {
      console.error('[BOOKING CANCEL NOTIFY ERROR]', e.message);
    }
  })();

  return res.json({ ok: true });
}));

app.post('/api/booking/appointments/:id/reschedule', requireBookingAccess, asyncRoute(async (req, res) => {
  const { date, startTime } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !isValidBookingDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '')) {
    return res.status(400).json({ error: 'Nueva fecha u hora inválida.' });
  }

  const { data, error } = await supabase.rpc('reagendar_cita_segura', {
    p_user_id: WHATSAPP_ADMIN_USER_ID,
    p_cliente_id: req.bookingClientId,
    p_cita_id: req.params.id,
    p_fecha: date,
    p_hora_inicio: startTime,
  });
  if (error) {
    console.error('[Booking Error] Error en RPC reagendar_cita_segura:', error);
    let status = 503;
    let message = error.message || 'No se pudo reagendar la cita.';

    if (error.code === 'P0001') {
      status = 409;
    } else if (error.code === 'PGRST202') {
      status = 503;
      message = 'Error de servidor: La función "reagendar_cita_segura" no está instalada en Supabase (migración pendiente).';
    }

    return res.status(status).json({ error: message, details: error.details || null });
  }

  // Notificar reagendamiento por WhatsApp
  (async () => {
    try {
      const { data: citaData } = await supabase.from('citas').select('*, servicios(nombre)').eq('id', req.params.id).maybeSingle();
      if (citaData) {
        const cleanNum = (citaData.cliente_numero || '').replace(/\D/g, '');
        if (cleanNum) {
          const plantillas = await getPlantillasFromDB(WHATSAPP_ADMIN_USER_ID);
          const plantillaTarget = plantillas.reagendamiento;
          if (plantillaTarget) {
            const msg = formatPlantillaMensaje(plantillaTarget, {
              cliente_id: citaData.cliente_id,
              nombre_cliente: citaData.cliente_nombre || 'Clienta',
              servicio: citaData.servicios?.nombre || 'Servicio',
              fecha_cita: date,
              hora_cita: startTime,
            });
            await sendEvolutionMessage(`${cleanNum}@s.whatsapp.net`, msg, true);
          }
        }
        const botConfig = await getBotConfigFromDB();
        if (botConfig?.telefonoProfesional) {
          const adminMsg = `🔄 *Cita Reagendada Online*\n\n👤 *Clienta:* ${citaData.cliente_nombre}\n💅 *Servicio:* ${citaData.servicios?.nombre || 'Servicio'}\n🗓️ *Nueva Fecha:* ${date}\n⏰ *Nueva Hora:* ${startTime}`;
          await sendEvolutionMessage(`${botConfig.telefonoProfesional.replace(/\D/g, '')}@s.whatsapp.net`, adminMsg, false);
        }
      }
    } catch (e) {
      console.error('[BOOKING RESCHEDULE NOTIFY ERROR]', e.message);
    }
  })();

  return res.json({ appointment: data });
}));

// Expiración por inactividad del estado HUMANO (2 horas en ms)
const HUMAN_STATE_EXPIRATION_MS = 2 * 60 * 60 * 1000;

// Mapeo en memoria de clientes que ya están en estado HUMANO (clientId => timestamp)
const humanStateCache = new Map();

/**
 * Carga en caché los clientes que están en estado HUMANO al iniciar el servidor.
 */
async function loadHumanStateCache() {
  try {
    const { data, error } = await supabase
      .from('conversacion_estado')
      .select('cliente_id, telefono, estado, updated_at')
      .eq('estado', 'HUMANO');

    if (error) {
      console.warn('[CACHE] No se pudo cargar el caché de estado HUMANO:', error.message);
      return;
    }

    if (data) {
      const now = Date.now();
      for (const row of data) {
        const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : now;
        if (now - updatedAt > HUMAN_STATE_EXPIRATION_MS) {
          await updateConversationState(row.cliente_id, 'MENU_PRINCIPAL', row.telefono);
        } else {
          if (row.cliente_id) humanStateCache.set(row.cliente_id, updatedAt);
          if (row.telefono) humanStateCache.set(row.telefono.replace(/\D/g, ''), updatedAt);
        }
      }
    }

    console.log(`[CACHE] Cargados ${humanStateCache.size} identificadores activos en estado HUMANO.`);
  } catch (err) {
    console.warn('[CACHE] Error al cargar caché HUMANO:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: POST /webhook/evolution
// Recibe los eventos de Evolution API y ejecuta la lógica del bot.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook/evolution', requireEvolutionWebhook, asyncRoute(async (req, res) => {
  // ── 1. Responder HTTP 200 de inmediato para no bloquear Evolution ──────────
  res.sendStatus(200);

  const body = req.body;
  const event = body?.event;
  const data = body?.data;

  // ── 2. Filtrar: solo procesar eventos de nuevos mensajes ──────────────────
  if (event !== 'messages.upsert') {
    return;
  }

  // ── 3. Filtrar mensajes propios (Intervención de la Profesional) ─────────
  const fromMe = data?.key?.fromMe === true;

  if (fromMe) {
    const rawText =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      '';

    const canonicalJid = getCanonicalJid(data);
    if (canonicalJid && !canonicalJid.includes('@g.us') && !canonicalJid.includes('@newsletter')) {
      const cleanIdentifier = extractCleanIdentifier(canonicalJid);
      const isLid = canonicalJid.includes('@lid') || cleanIdentifier.length >= 14;

      // Resolver o crear el cliente receptor
      const clientInfo = await findOrCreateClient(cleanIdentifier, '', isLid);
      const clientId = clientInfo?.id || null;

      // Si el contacto está en Lista Blanca, mantener exclusión absoluta
      const isWhitelisted = await isNumberInWhiteList(cleanIdentifier, clientInfo?.numero, clientId);
      if (isWhitelisted) {
        console.log(`[BOT] Profesional interactuó con contacto en Lista Blanca (${cleanIdentifier}).`);
        return;
      }

      if (isCerrarCommand(rawText)) {
        // El profesional envió "cerrar." -> reactivar el bot
        await updateConversationState(clientId, 'MENU_PRINCIPAL', cleanIdentifier);
        console.log(`[BOT] Profesional envió comando 'cerrar.' para chat ${cleanIdentifier}. Bot reactivado.`);
      } else if (isPausarCommand(rawText)) {
        // El profesional envió "pausar." -> pausar el bot
        await updateConversationState(clientId, 'HUMANO', cleanIdentifier);
        console.log(`[BOT] Profesional envió comando 'pausar.' para chat ${cleanIdentifier}. Bot silenciado.`);
      } else if (rawText && rawText.trim()) {
        // La profesional envió cualquier mensaje manual -> auto-silenciar el bot para este chat
        await updateConversationState(clientId, 'HUMANO', cleanIdentifier);
        console.log(`[BOT] Intervención de la profesional detectada en chat ${cleanIdentifier}. Bot silenciado (HUMANO).`);
      }
    }
    return;
  }

  // ── 4. De aquí en adelante, fromMe = false → mensaje del cliente ──────────

  const remoteJid = data?.key?.remoteJid || '';

  // ── 5. Filtrar grupos y canales ───────────────────────────────────────────
  if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter')) {
    return;
  }

  // ── 6. Obtener JID canónico (soporte LID de Meta) ─────────────────────────
  const canonicalJid = getCanonicalJid(data);
  if (!canonicalJid) {
    console.warn('[WEBHOOK] No se pudo determinar el JID canónico. Ignorando.');
    return;
  }

  // ── 7. Extraer identificador limpio para BD ────────────────────────────────
  const cleanIdentifier = extractCleanIdentifier(canonicalJid);

  if (!cleanIdentifier) {
    console.warn('[WEBHOOK] No se pudo extraer identificador limpio. Ignorando.');
    return;
  }

  // ── 8. Filtrar mensajes que no son texto plano ────────────────────────────
  const msgObj = data?.message || {};
  const rawText =
    msgObj.conversation ||
    msgObj.extendedTextMessage?.text ||
    '';

  if (!rawText) {
    console.log('[WEBHOOK] Mensaje no textual ignorado.');
    return;
  }

  // ── 9. Normalizar texto ───────────────────────────────────────────────────
  const normalizedText = normalizeText(rawText);

  console.log('[WEBHOOK] Mensaje de texto recibido de:', cleanIdentifier);

  // ── 10. Validar si el bot está activo globalmente ──────────────────────────
  const botConfig = await getBotConfigFromDB();
  if (!botConfig || !botConfig.botActivo) {
    console.log('[BOT] Bot inactivo globalmente; mensaje ignorado.');
    return;
  }

  const telefonoProfesional = botConfig.telefonoProfesional;

  // ── 11. Buscar o reconciliar cliente en BD ────────────────────────────────
  const isLid =
    canonicalJid.includes('@lid') ||
    data?.key?.addressingMode === 'lid' ||
    cleanIdentifier.length >= 14;

  const clientInfo = await findOrCreateClient(cleanIdentifier, data?.pushName || '', isLid);
  if (!clientInfo || !clientInfo.id) {
    console.error('[BOT] No se pudo resolver o crear el cliente.');
    return;
  }

  const clientId = clientInfo.id;

  // ── 12. Validar si el cliente o su número está en la Lista Blanca ──────────
  const isWhitelisted = await isNumberInWhiteList(cleanIdentifier, clientInfo?.numero, clientId);
  if (isWhitelisted) {
    console.log(`[BOT] El remitente ${cleanIdentifier} (asociado: ${clientInfo?.numero || 'N/A'}, nombre: ${clientInfo?.nombre || 'N/A'}) está en la Lista Blanca. Bot ignorando mensaje.`);
    return;
  }

  // ── 13. Comandos del cliente (cerrar. o pausar.) ──────────────────────────
  if (isCerrarCommand(rawText)) {
    await updateConversationState(clientId, 'MENU_PRINCIPAL', cleanIdentifier);
    console.log(`[BOT] Cliente envió comando 'cerrar.' para chat ${cleanIdentifier}. Bot reactivado.`);
    return;
  }

  if (isPausarCommand(rawText)) {
    await updateConversationState(clientId, 'HUMANO', cleanIdentifier);
    console.log(`[BOT] Cliente envió comando 'pausar.' para chat ${cleanIdentifier}. Bot silenciado.`);
    return;
  }

  // ── 14. Validar si la conversación está en estado HUMANO (atención activa) ─
  const inHumanState = await isClientInHumanState(clientId, cleanIdentifier, clientInfo?.numero);
  if (inHumanState) {
    console.log(`[BOT] Mensaje de cliente ${cleanIdentifier} IGNORADO: chat en estado HUMANO (atención manual activa).`);
    return;
  }

  // ── 14. Detectar petición de atención humana ──────────────────────────────
  const agentKeywords = config.agentKeywords || [];
  const wantsAgent = agentKeywords.some((kw) =>
    normalizedText.includes(normalizeText(kw))
  );

  if (wantsAgent) {
    console.log('[BOT] El cliente solicitó atención humana.');

    // Actualizar estado a HUMANO
    const updated = await updateConversationState(clientId, 'HUMANO');
    if (updated) {
      humanStateCache.set(clientId, Date.now());
    }

    // Responder al cliente que será atendido por un asesor
    const clientResponse =
      `😎 *Transferencia a asesor*\n\n` +
      `Te estamos transfiriendo con un asesor. En breve se pondrá en contacto contigo. 👩‍💻`;

    try {
      await sendMessageWithTyping(canonicalJid, clientResponse);
      console.log('[BOT] Mensaje de transferencia enviado.');
    } catch (err) {
      console.error('[BOT] Error al enviar el mensaje de transferencia:', err?.response?.status || 'sin respuesta');
    }

    // Notificar al profesional si existe teléfono_profesional configurado
    if (telefonoProfesional) {
      try {
        await notifyProfessional(telefonoProfesional, canonicalJid, rawText);
        console.log('[BOT] Notificación enviada al profesional.');
      } catch (err) {
        console.error('[BOT] Error al notificar al profesional:', err?.response?.status || 'sin respuesta');
      }
    }

    return;
  }

  // ── 15. Resolver respuesta según FAQ o default ────────────────────────────
  const faq = matchFaq(normalizedText);
  const responseText = buildResponseText(faq, clientId);
  const usePreview = faq
    ? Boolean(faq.link)
    : Boolean(config.defaultSelfService?.linkPreview && empresaData);

  if (faq) {
    console.log(`[BOT] FAQ coincidente: "${faq.id}". Respondiendo a cliente ${clientId}.`);
  } else {
    console.log(`[BOT] Sin FAQ. Usando respuesta de autoservicio para cliente ${clientId}.`);
  }

  // ── 16. Enviar respuesta con simulación de escritura ──────────────────────
  try {
    await sendMessageWithTyping(canonicalJid, responseText, usePreview);
    console.log('[BOT] Respuesta enviada al cliente.');
  } catch (err) {
    console.error(
      '[BOT] Error al enviar la respuesta al cliente:',
      err?.response?.status || 'sin respuesta'
    );
  }
}));

// Función auxiliar para resolver el clientId a partir del JID canónico
async function resolveClientIdByJid(canonicalJid) {
  const cleanIdentifier = extractCleanIdentifier(canonicalJid);
  if (!cleanIdentifier) return null;

  const isLid = canonicalJid.includes('@lid') || cleanIdentifier.length >= 14;
  const last10 = cleanIdentifier.length >= 10 ? cleanIdentifier.slice(-10) : cleanIdentifier;

  try {
    let query = supabase.from('clientes').select('id');
    if (isLid) {
      query = query.eq('lid', cleanIdentifier);
    } else {
      query = query.or(`numero.eq.${cleanIdentifier},numero.ilike.%${last10},lid.eq.${cleanIdentifier}`);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (!error && data?.id) {
      return data.id;
    }
  } catch (err) {
    console.error('[BD] Error inesperado en resolveClientIdByJid:', err.message);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: GET /api/config
// Retorna la configuración activa en memoria (sin datos de BD).
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/config', requireAdminKey, (_req, res) => {
  res.json({
    config,
    empresa: empresaData ? {
      nombre: empresaData.nombre,
      horario: empresaData.horario,
      direccion: empresaData.direccion,
      nom_bot: empresaData.nom_bot,
    } : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: POST /api/config
// Recibe un JSON, lo valida mínimamente, lo persiste en disco y actualiza
// la configuración en memoria sin reiniciar el servidor (hot-reload).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/config', requireAdminKey, (req, res) => {
  const newConfig = req.body;

  if (typeof newConfig !== 'object' || Array.isArray(newConfig) || !newConfig) {
    return res.status(400).json({ error: 'El cuerpo debe ser un objeto JSON válido.' });
  }

  if (!Array.isArray(newConfig.faqs)) {
    return res.status(400).json({ error: 'El campo "faqs" debe ser un array.' });
  }

  if (!Array.isArray(newConfig.agentKeywords)) {
    return res.status(400).json({ error: 'El campo "agentKeywords" debe ser un array.' });
  }

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CONFIG] Error al escribir config.json:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la configuración en disco.' });
  }

  config = newConfig;
  console.log('[CONFIG] Configuración actualizada en caliente.');
  res.json({ ok: true, message: 'Configuración actualizada exitosamente.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: GET /health
// Endpoint de salud para orquestadores (Docker, K8s, etc.)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use((error, _req, res, _next) => {
  console.error('[HTTP] Error inesperado:', error?.stack || error?.message || error);
  if (res.headersSent) return;
  return res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta API: POST /api/verify-or-create-client
// Permite a la PWA o al Panel Admin verificar/crear una clienta por su teléfono y nombre
// y retornar un token de acceso seguro para agendar de forma directa.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify-or-create-client', async (req, res) => {
  const { nombre, telefono } = req.body || {};

  if (!telefono || !telefono.trim()) {
    return res.status(400).json({ error: 'Ingresa un número telefónico válido.' });
  }

  const cleanPhone = telefono.replace(/\D/g, '');
  if (cleanPhone.length < 7) {
    return res.status(400).json({ error: 'El número telefónico es demasiado corto.' });
  }

  // Normalizar teléfono colombiano si viene en 10 dígitos empezando por 3
  const fullPhone = (cleanPhone.length === 10 && cleanPhone.startsWith('3'))
    ? `57${cleanPhone}`
    : cleanPhone;

  try {
    const client = await findOrCreateClient(fullPhone, nombre || 'Cliente Directo', false, fullPhone);
    if (!client || !client.id) {
      return res.status(500).json({ error: 'No se pudo registrar o verificar la clienta.' });
    }

    // Generar token seguro de acceso para la PWA de reservas
    const token = createBookingToken(client.id);

    return res.json({
      ok: true,
      id: client.id,
      token: token,
      cliente: {
        id: client.id,
        nombre: client.nombre || nombre || 'Cliente Directo',
        telefono: fullPhone,
        numero: fullPhone,
        lid: client.lid || null,
      },
    });
  } catch (err) {
    console.error('[API VERIFY CLIENT] Error:', err.message);
    return res.status(500).json({ error: 'Error al verificar la clienta.', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta API: POST /api/templates/send
// Permite enviar mensajes basados en las plantillas personalizadas de Supabase
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/templates/send', async (req, res) => {
  const { to, templateType, data: customData, userId } = req.body || {};

  if (!to || !templateType) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: "to" y "templateType".' });
  }

  try {
    const plantillas = await getPlantillasFromDB(userId || WHATSAPP_ADMIN_USER_ID);
    const plantillaTarget = plantillas[templateType];

    if (!plantillaTarget) {
      return res.status(404).json({ error: `La plantilla "${templateType}" no existe.` });
    }

    const cleanNum = to.replace(/\D/g, '');
    const toRecipient = to.includes('@') ? to : `${cleanNum}@s.whatsapp.net`;

    let enrichedData = { ...(customData || {}) };
    if (!enrichedData.cliente_id && cleanNum) {
      const client = await findOrCreateClient(cleanNum, enrichedData.nombre_cliente || '', false, cleanNum);
      if (client?.id) {
        enrichedData.cliente_id = client.id;
      }
    }

    const messageText = formatPlantillaMensaje(plantillaTarget, enrichedData);

    await sendEvolutionMessage(toRecipient, messageText, true);
    console.log(`[API TEMPLATES] Mensaje de plantilla "${templateType}" enviado a ${cleanNum}`);

    return res.json({ ok: true, message: `Plantilla ${templateType} enviada exitosamente.` });
  } catch (err) {
    console.error(`[API TEMPLATES] Error enviando plantilla ${templateType}:`, err.message);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje por WhatsApp.', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Worker de Recordatorios Automáticos (24 Horas y 2 Horas Antes)
// ─────────────────────────────────────────────────────────────────────────────
async function processAppointmentReminders() {
  if (!SUPABASE_SERVICE_ROLE_KEY || !WHATSAPP_ADMIN_USER_ID || !BOOKING_LINK_SECRET) {
    return;
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Cargar plantillas desde Supabase (si existen)
    const plantillas = await getPlantillasFromDB(WHATSAPP_ADMIN_USER_ID);

    const { data: citas, error } = await supabase
      .from('citas')
      .select('id, user_id, cliente_id, cliente_nombre, cliente_numero, servicio_id, fecha_inicio, hora_inicio, estado, recordatorio_24h_enviado, recordatorio_2h_enviado, servicios(nombre)')
      .eq('user_id', WHATSAPP_ADMIN_USER_ID)
      .gte('fecha_inicio', todayStr)
      .limit(50);

    if (error || !Array.isArray(citas)) {
      if (error && error.code !== '42703') {
        console.error('[RECORDATORIO] Error al consultar citas para recordatorios:', error.message);
      }
      return;
    }

    for (const cita of citas) {
      if (!ACTIVE_APPOINTMENT_STATES.has(cita.estado?.toUpperCase())) continue;
      if (!cita.cliente_numero || !cita.fecha_inicio || !cita.hora_inicio) continue;

      const horaClean = cita.hora_inicio.slice(0, 5);
      // Especificar la zona horaria de Colombia (-05:00) para evitar desfases UTC en servidores VPS
      const citaDateTimeStr = `${cita.fecha_inicio}T${horaClean}:00-05:00`;
      const citaDate = new Date(citaDateTimeStr);
      if (isNaN(citaDate.getTime())) continue;

      const diffMs = citaDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`[RECORDATORIO EVAL] Cita ${cita.id} (${cita.cliente_nombre}): Faltan ${diffHours.toFixed(2)}h`);

      if (diffHours < 0) continue;

      let bookingUrl = PWA_URL;
      if (cita.cliente_id) {
        const token = createBookingToken(cita.cliente_id);
        if (token) {
          const url = new URL(PWA_URL);
          url.searchParams.set('id', cita.cliente_id);
          url.searchParams.set('token', token);
          bookingUrl = url.toString();
        }
      }

      const servicioNombre = cita.servicios?.nombre || 'tu servicio';
      const cleanNum = cita.cliente_numero.replace(/\D/g, '');
      if (!cleanNum) continue;

      const toRecipient = cita.cliente_numero.includes('@')
        ? cita.cliente_numero
        : `${cleanNum}@s.whatsapp.net`;

      const datosPlantilla = {
        nombre_cliente: cita.cliente_nombre || 'Cliente',
        servicio: servicioNombre,
        fecha_cita: cita.fecha_inicio,
        hora_cita: horaClean,
        nombre_empresa: empresaData?.nombre || 'Angel Nails Studio',
        direccion_empresa: empresaData?.direccion || '',
        link_reserva: bookingUrl,
      };

      // 1. Recordatorio 24 horas antes (ventana entre 23h y 25h)
      if (!cita.recordatorio_24h_enviado && diffHours >= 23 && diffHours <= 25) {
        let msg24h = '';
        if (plantillas?.recordatorio && plantillas.recordatorio.activa !== false) {
          msg24h = formatPlantillaMensaje(plantillas.recordatorio, datosPlantilla);
        } else {
          msg24h = `🌸 *Recordatorio de Cita - Angel Nails* 💅\n\n` +
            `Hola *${cita.cliente_nombre || 'Cliente'}*, te recordamos tu cita para mañana para *${servicioNombre}*:\n\n` +
            `📅 *Fecha:* ${cita.fecha_inicio}\n` +
            `⏰ *Hora:* ${horaClean}\n\n` +
            `⚠️ *¿Necesitas cambiar o cancelar tu cita?*\n` +
            `Si no puedes asistir, por favor reagenda o cancela con anticipación para liberar tu lugar a otra clienta:\n` +
            `👉 ${bookingUrl}\n\n` +
            `¡Te esperamos! ✨`;
        }

        try {
          await sendEvolutionMessage(toRecipient, msg24h, true);
          await supabase.from('citas').update({ recordatorio_24h_enviado: true }).eq('id', cita.id);
          console.log(`[RECORDATORIO] Recordatorio de 24h enviado a ${cita.cliente_nombre} (${cleanNum})`);
        } catch (sendErr) {
          console.error(`[RECORDATORIO] Error al enviar recordatorio 24h a ${cita.id}:`, sendErr.message);
        }
      }

      // 2. Recordatorio 2 horas antes (ventana entre 1.5h y 2.5h)
      if (!cita.recordatorio_2h_enviado && diffHours >= 1.5 && diffHours <= 2.5) {
        let msg2h = '';
        if (plantillas?.recordatorio && plantillas.recordatorio.activa !== false) {
          msg2h = formatPlantillaMensaje(plantillas.recordatorio, datosPlantilla);
        } else {
          msg2h = `⏳ *¡Tu cita es en 2 horas! - Angel Nails* 💅\n\n` +
            `Hola *${cita.cliente_nombre || 'Cliente'}*, te recordamos tu cita de hoy:\n\n` +
            `💅 *Servicio:* ${servicioNombre}\n` +
            `⏰ *Hora:* ${horaClean}\n\n` +
            `Si tuviste algún inconveniente de última hora, por favor reagenda o cancela aquí para liberar tu espacio:\n` +
            `👉 ${bookingUrl}\n\n` +
            `¡Nos vemos pronto! 💖`;
        }

        try {
          await sendEvolutionMessage(toRecipient, msg2h, true);
          await supabase.from('citas').update({ recordatorio_2h_enviado: true }).eq('id', cita.id);
          console.log(`[RECORDATORIO] Recordatorio de 2h enviado a ${cita.cliente_nombre} (${cleanNum})`);
        } catch (sendErr) {
          console.error(`[RECORDATORIO] Error al enviar recordatorio 2h a ${cita.id}:`, sendErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[RECORDATORIO] Error general en processAppointmentReminders:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Arranque del servidor
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('─────────────────────────────────────────────────');
  console.log('  🤖  WhatsApp Autoresponder  |  Evolution API');
  console.log('─────────────────────────────────────────────────');
  console.log(`  ✅  Servidor escuchando en http://localhost:${PORT}`);
  console.log(`  📋  Instancia Evolution : ${EVOLUTION_INSTANCE}`);
  console.log(`  📚  FAQs estáticas cargadas: ${config.faqs?.length ?? 0}`);
  console.log(`  ⏱️  Delay de escritura    : 2-6 segundos (aleatorio)`);

  // Cargar datos de empresa al iniciar
  await loadEmpresaData();

  // Cargar en caché los clientes en estado HUMANO
  await loadHumanStateCache();

  // Iniciar worker de recordatorios de citas
  processAppointmentReminders().catch(() => {});
  setInterval(processAppointmentReminders, 10 * 60 * 1000);
  console.log('  ⏰  Worker de recordatorios automáticos (24h/2h): ACTIVADO');

  console.log('─────────────────────────────────────────────────');
});

