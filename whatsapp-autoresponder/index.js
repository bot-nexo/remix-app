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
const { createClient } = require('@supabase/supabase-js');

// ─── Constantes de entorno ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8480';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'default';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Ruta al archivo de configuración ────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');

// ─── Link del portal PWA (real) ──────────────────────────────────────────────
const PWA_URL = 'https://angelnailsagenda.netlify.app/reservar';

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

  // Link al portal con el id del cliente
  if (clientId) {
    const url = `${PWA_URL}?id=${clientId}`;
    lines.push(`Para consultar disponibilidad, agendar, cancelar o modificar tu cita en línea, ingresa a nuestro sitio web:`);
    lines.push('');
    lines.push(`👉 ${url}`);
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

  console.log(`[TYPING] Simulando escritura para ${to} por ${delay}ms...`);

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
    console.warn(`[TYPING] No se pudo enviar presence typing para ${to}:`, err?.response?.data || err.message);
  }

  // Esperar el delay aleatorio
  await new Promise((resolve) => setTimeout(resolve, delay));

  console.log(`[TYPING] Escritura simulada por ${delay}ms para ${to}.`);
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
app.use(express.json());

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
app.post('/webhook/evolution', async (req, res) => {
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
            console.log(`[BOT] Profesional cerró conversación. Cliente ${clientId} → MENU_PRINCIPAL.`);
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
    console.log(`[WEBHOOK] Mensaje no textual de ${canonicalJid}. Ignorando.`);
    return;
  }

  // ── 9. Normalizar texto ───────────────────────────────────────────────────
  const normalizedText = normalizeText(rawText);

  console.log(`[WEBHOOK] Mensaje de ${canonicalJid} (${cleanIdentifier}): "${rawText}"`);

  // ── 10. Validar si el bot está activo ──────────────────────────────────────
  const botConfig = await getBotConfigFromDB();
  if (!botConfig || !botConfig.botActivo) {
    console.log(`[BOT] Bot inactivo. Mensaje de ${canonicalJid} ignorado.`);
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
    console.error(`[BOT] No se pudo resolver/crear cliente para ${canonicalJid}.`);
    return;
  }

  const clientId = clientInfo.id;

  // ── 12. Verificar si el cliente ya está en estado HUMANO ──────────────────
  const inHumanState = humanStateCache.has(clientId) ||
                       await isClientInHumanState(clientId);

  if (inHumanState) {
    console.log(`[BOT] Cliente ${clientId} está en estado HUMANO. Mensaje ignorado por el autoresponder.`);
    return;
  }

  // ── 13. Detectar comando "cerrar." del cliente ────────────────────────────
  if (isCerrarCommand(rawText)) {
    await updateConversationState(clientId, 'MENU_PRINCIPAL');
    humanStateCache.delete(clientId);
    console.log(`[BOT] Cliente ${clientId} escribió "cerrar.". Estado → MENU_PRINCIPAL.`);
    return;
  }

  // ── 14. Detectar petición de atención humana ──────────────────────────────
  const agentKeywords = config.agentKeywords || [];
  const wantsAgent = agentKeywords.some((kw) =>
    normalizedText.includes(normalizeText(kw))
  );

  if (wantsAgent) {
    console.log(`[BOT] Cliente ${clientId} solicitó atención humana. Cambiando a HUMANO.`);

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
      console.log(`[BOT] Mensaje de transferencia enviado a ${canonicalJid}.`);
    } catch (err) {
      console.error(`[BOT] Error al enviar mensaje de transferencia a ${canonicalJid}:`, err?.response?.data || err.message);
    }

    // Notificar al profesional si existe teléfono_profesional configurado
    if (telefonoProfesional) {
      try {
        await notifyProfessional(telefonoProfesional, canonicalJid, rawText);
        console.log(`[BOT] Notificación enviada al profesional ${telefonoProfesional}.`);
      } catch (err) {
        console.error(`[BOT] Error al notificar al profesional:`, err?.response?.data || err.message);
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
    console.log(`[BOT] Mensaje enviado a cliente ${clientId} (${canonicalJid}).`);
  } catch (err) {
    console.error(
      `[BOT] Error al enviar mensaje a cliente ${clientId} (${canonicalJid}):`,
      err?.response?.data || err.message
    );
  }
});

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
    empresa: empresaData ? {
      nombre: empresaData.nombre,
      bot: empresaData.nom_bot,
    } : null,
  });
});

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

  console.log('─────────────────────────────────────────────────');
});

