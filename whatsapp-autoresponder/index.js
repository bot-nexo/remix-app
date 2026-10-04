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
const FRONTEND_ORIGINS = new Set(
  (process.env.FRONTEND_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    throw new Error(`Faltan variables de producción requeridas: ${missingSettings.join(', ')}`);
  }
  if (ADMIN_API_KEY.length < 32 || EVOLUTION_WEBHOOK_SECRET.length < 32 || BOOKING_LINK_SECRET.length < 32) {
    throw new Error('ADMIN_API_KEY, EVOLUTION_WEBHOOK_SECRET y BOOKING_LINK_SECRET deben tener al menos 32 caracteres.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(WHATSAPP_ADMIN_USER_ID)) {
    throw new Error('WHATSAPP_ADMIN_USER_ID debe ser un UUID válido.');
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
 * Detecta si el mensaje es "cerrar." (exclusivamente ese texto, case-insensitive).
 * @param {string} text
 * @returns {boolean}
 */
function isCerrarCommand(text) {
  return normalizeText(text.trim()) === 'cerrar.';
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
 *
 * Meta está migrando identificadores de usuario de `@s.whatsapp.net` a `@lid`.
 * Evolution API expone `remoteJidAlt` cuando detecta que el JID principal
 * es un LID y el alternativo es el JID "viejo" (o viceversa).
 *
 * @param {object} data - Objeto `data` del evento `messages.upsert`.
 * @returns {string}    - JID canónico a usar como clave de cooldown y destinatario.
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
 * @param {string} jid - JID canónico.
 * @returns {string}
 */
function extractCleanIdentifier(jid) {
  const firstPart = (jid || '').split('@')[0] || '';
  return firstPart.replace(/\D/g, '');
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
  if (faq) {
    let text = faq.message || '';

    // Si la FAQ tiene un link propio (ej: precios, pedidos), agregar
    if (faq.link) {
      text += `\n\n${faq.link}`;
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
 * Busca un cliente por teléfono o LID. Si no existe, lo crea.
 * @param {string} identifier - Número o LID limpio (solo dígitos).
 * @param {string} pushName   - Nombre del cliente desde Evolution (opcional).
 * @param {boolean} isLid      - Si el identificador es un LID.
 * @returns {Promise<{ id: string } | null>}
 */
async function findOrCreateClient(identifier, pushName = '', isLid = false) {
  try {
    let cliente = null;

    if (isLid) {
      const { data: lidData, error: lidError } = await supabase
        .from('clientes')
        .select('id, numero, lid, nombre')
        .eq('lid', identifier)
        .limit(1);

      if (lidError) {
        console.error('[BD] Error al buscar cliente por LID:', lidError.message);
        return null;
      }

      if (lidData && lidData.length > 0) {
        cliente = lidData[0];
      }
    } else {
      const { data: phoneData, error: phoneError } = await supabase
        .from('clientes')
        .select('id, numero, lid, nombre')
        .eq('numero', identifier)
        .limit(1);

      if (phoneError) {
        console.error('[BD] Error al buscar cliente por número:', phoneError.message);
        return null;
      }

      if (phoneData && phoneData.length > 0) {
        cliente = phoneData[0];
      }
    }

    // Si no existe, crearlo
    if (!cliente) {
      const nombre = pushName || 'Cliente WhatsApp';

      const { data: insertData, error: insertError } = await supabase
        .from('clientes')
        .insert({
          nombre: nombre,
          numero: isLid ? null : identifier,
          lid: isLid ? identifier : null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[BD] Error al crear cliente:', insertError.message);
        return null;
      }

      return { id: insertData.id };
    }

    return { id: cliente.id };
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
 * Obtiene o crea el estado de conversación para un cliente.
 * @param {string} clientId - UUID del cliente.
 * @param {string} estado   - Estado inicial si no existe ('MENU_PRINCIPAL').
 * @returns {Promise<{ estado: string } | null>}
 */
async function getOrCreateConversationState(clientId, estado = 'MENU_PRINCIPAL') {
  try {
    const { data, error } = await supabase
      .from('conversacion_estado')
      .select('estado')
      .eq('cliente_id', clientId)
      .limit(1);

    if (error) {
      console.error('[BD] Error al consultar conversacion_estado:', error.message);
      return null;
    }

    if (data && data.length > 0) {
      return { estado: data[0].estado };
    }

    const { data: insertData, error: insertError } = await supabase
      .from('conversacion_estado')
      .insert({
        cliente_id: clientId,
        estado: estado,
      })
      .select('estado')
      .single();

    if (insertError) {
      console.error('[BD] Error al crear conversacion_estado:', insertError.message);
      return null;
    }

    return { estado: insertData.estado };
  } catch (err) {
    console.error('[BD] Error inesperado en getOrCreateConversationState:', err.message);
    return null;
  }
}

/**
 * Actualiza el estado de conversación para un cliente.
 * Usa upsert con ON CONFLICT por cliente_id.
 * @param {string} clientId    - UUID del cliente.
 * @param {string} nuevoEstado - Nuevo estado ('HUMANO', 'MENU_PRINCIPAL', etc.).
 * @returns {Promise<boolean>}
 */
async function updateConversationState(clientId, nuevoEstado) {
  try {
    const { error } = await supabase
      .from('conversacion_estado')
      .upsert({
        cliente_id: clientId,
        estado: nuevoEstado,
      }, {
        onConflict: 'cliente_id',
      });

    if (error) {
      console.error('[BD] Error al actualizar conversacion_estado:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[BD] Error inesperado en updateConversationState:', err.message);
    return false;
  }
}

/**
 * Verifica si un cliente está en estado HUMANO.
 * @param {string} clientId - UUID del cliente.
 * @returns {Promise<boolean>}
 */
async function isClientInHumanState(clientId) {
  try {
    const { data, error } = await supabase
      .from('conversacion_estado')
      .select('estado')
      .eq('cliente_id', clientId)
      .limit(1);

    if (error) {
      console.error('[BD] Error al verificar estado HUMANO:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      return data[0].estado === 'HUMANO';
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
  if (origin && !FRONTEND_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }

  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  };

  if (req.method === 'OPTIONS') return res.sendStatus(origin ? 204 : 403);
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

app.get('/api/booking/context', requireBookingAccess, asyncRoute(async (_req, res) => {
  await loadEmpresaData();
  const botConfig = await getBotConfigFromDB();
  if (!botConfig) {
    return res.status(503).json({ error: 'No se pudo cargar la configuración del negocio.' });
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

  const { data, error } = await supabase.rpc('reservar_cita_segura', {
    p_user_id: WHATSAPP_ADMIN_USER_ID,
    p_servicio_id: serviceId,
    p_cliente_id: req.bookingClientId,
    p_cliente_nombre: name.trim(),
    p_cliente_numero: phone.trim(),
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
  return res.status(201).json({ appointment: data });
}));

app.post('/api/booking/appointments/:id/cancel', requireBookingAccess, asyncRoute(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Cita inválida.' });

  const query = supabase.from('citas').select('estado')
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
  return res.json({ appointment: data });
}));

// Mapeo en memoria de clientes que ya están en estado HUMANO (optimización)
const humanStateCache = new Map();

/**
 * Carga en caché los clientes que están en estado HUMANO al iniciar el servidor.
 */
async function loadHumanStateCache() {
  try {
    const { data, error } = await supabase
      .from('conversacion_estado')
      .select('cliente_id, estado')
      .eq('estado', 'HUMANO');

    if (error) {
      console.warn('[CACHE] No se pudo cargar el caché de estado HUMANO:', error.message);
      return;
    }

    if (data) {
      for (const row of data) {
        humanStateCache.set(row.cliente_id, true);
      }
    }

    console.log(`[CACHE] Cargados ${humanStateCache.size} clientes en estado HUMANO.`);
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

  // ── 3. Filtrar mensajes propios ───────────────────────────────────────────
  const fromMe = data?.key?.fromMe === true;

  if (fromMe) {
    // ── 3a. Si es mensaje propio (del profesional/instancia), validar si es "cerrar." ──
    const rawText =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      '';

    if (isCerrarCommand(rawText)) {
      // El profesional escribió "cerrar." → actualizar estado del cliente a MENU_PRINCIPAL
      const canonicalJid = getCanonicalJid(data);
      if (canonicalJid) {
        const clientId = await resolveClientIdByJid(canonicalJid);
        if (clientId) {
          const updated = await updateConversationState(clientId, 'MENU_PRINCIPAL');
          if (updated) {
            humanStateCache.delete(clientId);
            console.log('[BOT] Profesional cerró la conversación.');
          }
        }
      }
    }
    // Si no es "cerrar.", ignorar completamente (es el profesional atendiendo)
    return;
  }

  // ── 4. De aquí en adelante, fromMe = false → mensaje de cliente ────────────

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

  console.log('[WEBHOOK] Mensaje de texto recibido.');

  // ── 10. Validar si el bot está activo ──────────────────────────────────────
  const botConfig = await getBotConfigFromDB();
  if (!botConfig || !botConfig.botActivo) {
    console.log('[BOT] Bot inactivo; mensaje ignorado.');
    return;
  }

  const telefonoProfesional = botConfig.telefonoProfesional;

  // ── 11. Buscar o crear cliente en BD ──────────────────────────────────────
  const isLid =
    canonicalJid.includes('@lid') ||
    data?.key?.addressingMode === 'lid' ||
    cleanIdentifier.length > 12;

  const clientInfo = await findOrCreateClient(cleanIdentifier, data?.pushName || '', isLid);
  if (!clientInfo || !clientInfo.id) {
    console.error('[BOT] No se pudo resolver o crear el cliente.');
    return;
  }

  const clientId = clientInfo.id;

  // ── 12. Verificar si el cliente ya está en estado HUMANO ──────────────────
  const inHumanState = humanStateCache.has(clientId) ||
                       await isClientInHumanState(clientId);

  if (inHumanState) {
    console.log('[BOT] Mensaje ignorado porque la conversación está en estado HUMANO.');
    return;
  }

  // ── 13. Detectar comando "cerrar." del cliente ────────────────────────────
  if (isCerrarCommand(rawText)) {
    await updateConversationState(clientId, 'MENU_PRINCIPAL');
    humanStateCache.delete(clientId);
    console.log('[BOT] Conversación cerrada por el cliente.');
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
      humanStateCache.set(clientId, true);
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

  const isLid =
    canonicalJid.includes('@lid') ||
    cleanIdentifier.length > 12;

  try {
    let data;
    if (isLid) {
      const { data: lidData, error: lidError } = await supabase
        .from('clientes')
        .select('id')
        .eq('lid', cleanIdentifier)
        .limit(1);

      if (lidError) {
        console.error('[BD] Error al buscar cliente por LID:', lidError.message);
        return null;
      }
      data = lidData;
    } else {
      const { data: phoneData, error: phoneError } = await supabase
        .from('clientes')
        .select('id')
        .eq('numero', cleanIdentifier)
        .limit(1);

      if (phoneError) {
        console.error('[BD] Error al buscar cliente por número:', phoneError.message);
        return null;
      }
      data = phoneData;
    }

    if (data && data.length > 0) {
      return data[0].id;
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
// Worker de Recordatorios Automáticos (24 Horas y 2 Horas Antes)
// ─────────────────────────────────────────────────────────────────────────────
async function processAppointmentReminders() {
  if (!SUPABASE_SERVICE_ROLE_KEY || !WHATSAPP_ADMIN_USER_ID || !BOOKING_LINK_SECRET) {
    return;
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

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

      // 1. Recordatorio 24 horas antes (ventana entre 23h y 25h)
      if (!cita.recordatorio_24h_enviado && diffHours >= 23 && diffHours <= 25) {
        const msg24h = `🌸 *Recordatorio de Cita - Angel Nails* 💅\n\n` +
          `Hola *${cita.cliente_nombre || 'Cliente'}*, te recordamos tu cita para mañana para *${servicioNombre}*:\n\n` +
          `📅 *Fecha:* ${cita.fecha_inicio}\n` +
          `⏰ *Hora:* ${horaClean}\n\n` +
          `⚠️ *¿Necesitas cambiar o cancelar tu cita?*\n` +
          `Si no puedes asistir, por favor reagenda o cancela con anticipación para liberar tu lugar a otra clienta:\n` +
          `👉 ${bookingUrl}\n\n` +
          `¡Te esperamos! ✨`;

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
        const msg2h = `⏳ *¡Tu cita es en 2 horas! - Angel Nails* 💅\n\n` +
          `Hola *${cita.cliente_nombre || 'Cliente'}*, te recordamos tu cita de hoy:\n\n` +
          `💅 *Servicio:* ${servicioNombre}\n` +
          `⏰ *Hora:* ${horaClean}\n\n` +
          `Si tuviste algún inconveniente de última hora, por favor reagenda o cancela aquí para liberar tu espacio:\n` +
          `👉 ${bookingUrl}\n\n` +
          `¡Nos vemos pronto! 💖`;

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

