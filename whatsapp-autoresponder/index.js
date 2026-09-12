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
 *
 * Autor: <tu nombre>
 * Licencia: MIT
 */

'use strict';

// ─── Carga de variables de entorno ───────────────────────────────────────────
require('dotenv').config();

// ─── Módulos core / externos ──────────────────────────────────────────────────
const express = require('express');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');

// ─── Constantes de entorno ────────────────────────────────────────────────────
const PORT                 = process.env.PORT                 || 3000;
const ADMIN_API_KEY        = process.env.ADMIN_API_KEY        || '';
const EVOLUTION_API_URL    = process.env.EVOLUTION_API_URL    || 'http://localhost:8080';
const EVOLUTION_API_KEY    = process.env.EVOLUTION_API_KEY    || '';
const EVOLUTION_INSTANCE   = process.env.EVOLUTION_INSTANCE_NAME || 'default';

// ─── Ruta al archivo de configuración ────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');

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

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2 · Cooldown en memoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapa de cooldown: jid (string) → timestamp de último mensaje respondido (number).
 * Un usuario en cooldown no recibirá nueva respuesta automática hasta que
 * haya transcurrido `config.cooldownMinutes` desde su último mensaje respondido.
 */
const cooldownMap = new Map();

/**
 * Comprueba si un JID está dentro del periodo de cooldown.
 * @param {string} jid  - Identificador canónico del usuario.
 * @returns {boolean}   - `true` si debe ignorarse el mensaje.
 */
function isInCooldown(jid) {
  if (!cooldownMap.has(jid)) return false;
  const lastReply   = cooldownMap.get(jid);
  const elapsedMs   = Date.now() - lastReply;
  const cooldownMs  = (config.cooldownMinutes || 10) * 60 * 1_000;
  return elapsedMs < cooldownMs;
}

/**
 * Actualiza (o crea) la entrada de cooldown para un JID al momento actual.
 * @param {string} jid
 */
function setCooldown(jid) {
  cooldownMap.set(jid, Date.now());
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 3 · Utilidades de texto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un texto para comparación: minúsculas + sin tildes/diacríticos.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')                    // descompone caracteres con diacrítico
    .replace(/[\u0300-\u036f]/g, '');    // elimina los diacríticos
}

/**
 * Devuelve el JID canónico del remitente.
 *
 * Meta está migrando identificadores de usuario de `@s.whatsapp.net` a `@lid`.
 * Evolution API expone `remoteJidAlt` cuando detecta que el JID principal
 * es un LID y el alternativo es el JID "viejo" (o viceversa).
 *
 * Estrategia: preferir `remoteJidAlt` si está presente y no es un grupo/canal,
 * de lo contrario usar `remoteJid`.
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

// ─────────────────────────────────────────────────────────────────────────────
// Sección 4 · Lógica de resolución de respuesta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca la primera FAQ cuyas keywords coincidan con el texto normalizado.
 * @param {string} normalizedText
 * @returns {object|null} FAQ encontrada o `null`.
 */
function matchFaq(normalizedText) {
  for (const faq of (config.faqs || [])) {
    const matched = (faq.keywords || []).some((kw) =>
      normalizedText.includes(normalizeText(kw))
    );
    if (matched) return faq;
  }
  return null;
}

/**
 * Construye el texto final del mensaje de respuesta.
 * Si la FAQ o el defaultSelfService tienen un link, lo agrega al mensaje.
 * @param {object|null} faq   - FAQ encontrada (puede ser null).
 * @returns {string}          - Texto de respuesta.
 */
function buildResponseText(faq) {
  const source = faq || config.defaultSelfService;
  let text = source.message || '';
  if (source.link) {
    text += `\n\n${source.link}`;
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 5 · Integración con Evolution API
// ─────────────────────────────────────────────────────────────────────────────

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
    number : to,
    text   : text,
    options: {
      delay      : 1200,    // pequeña demora para simular escritura (ms)
      presence   : 'composing',
      linkPreview: preview,
    },
  };

  await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      apikey        : EVOLUTION_API_KEY,
    },
    timeout: 10_000,
  });
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
    // Si no se configuró clave, bloquear por seguridad
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

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: POST /webhook/evolution
// Recibe los eventos de Evolution API y ejecuta la lógica del bot.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook/evolution', async (req, res) => {
  // ── 1. Responder HTTP 200 de inmediato para no bloquear Evolution ──────────
  res.sendStatus(200);

  const body  = req.body;
  const event = body?.event;
  const data  = body?.data;

  // ── 2. Filtrar: solo procesar eventos de nuevos mensajes ──────────────────
  if (event !== 'messages.upsert') {
    return;
  }

  // ── 3. Filtrar mensajes propios ───────────────────────────────────────────
  if (data?.key?.fromMe === true) {
    return;
  }

  const remoteJid = data?.key?.remoteJid || '';

  // ── 4. Filtrar grupos y canales ───────────────────────────────────────────
  if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter')) {
    return;
  }

  // ── 5. Obtener JID canónico (soporte LID de Meta) ─────────────────────────
  const canonicalJid = getCanonicalJid(data);
  if (!canonicalJid) {
    console.warn('[WEBHOOK] No se pudo determinar el JID canónico. Ignorando.');
    return;
  }

  // ── 6. Filtrar mensajes que no son texto plano ────────────────────────────
  //    Evolution API envía la estructura del mensaje en data.message.
  //    Solo procesamos `conversation` o `extendedTextMessage`.
  const msgObj = data?.message || {};
  const rawText =
    msgObj.conversation ||
    msgObj.extendedTextMessage?.text ||
    '';

  if (!rawText) {
    console.log(`[WEBHOOK] Mensaje no textual de ${canonicalJid}. Ignorando.`);
    return;
  }

  // ── 7. Normalizar texto ───────────────────────────────────────────────────
  const normalizedText = normalizeText(rawText);

  console.log(`[WEBHOOK] Mensaje de ${canonicalJid}: "${rawText}"`);

  // ── 8. Detectar petición de atención humana ───────────────────────────────
  const wantsAgent = (config.agentKeywords || []).some((kw) =>
    normalizedText.includes(normalizeText(kw))
  );

  if (wantsAgent) {
    console.log(`[BOT] ${canonicalJid} solicitó atención humana. Bot silenciado.`);
    // Eliminar del mapa de cooldown para que un agente pueda retomar
    // sin restricciones de tiempo.
    cooldownMap.delete(canonicalJid);
    return;
  }

  // ── 9. Comprobar cooldown ─────────────────────────────────────────────────
  if (isInCooldown(canonicalJid)) {
    const remaining = Math.ceil(
      ((config.cooldownMinutes * 60_000) - (Date.now() - cooldownMap.get(canonicalJid))) / 60_000
    );
    console.log(`[BOT] ${canonicalJid} en cooldown (~${remaining} min restantes). Ignorando.`);
    return;
  }

  // ── 10. Resolver respuesta ────────────────────────────────────────────────
  const faq          = matchFaq(normalizedText);
  const responseText = buildResponseText(faq);
  const usePreview   = faq
    ? Boolean(faq.link)
    : Boolean(config.defaultSelfService?.linkPreview && config.defaultSelfService?.link);

  if (faq) {
    console.log(`[BOT] FAQ coincidente: "${faq.id}". Respondiendo a ${canonicalJid}.`);
  } else {
    console.log(`[BOT] Sin FAQ. Usando respuesta de autoservicio para ${canonicalJid}.`);
  }

  // ── 11. Enviar respuesta vía Evolution API ────────────────────────────────
  try {
    await sendEvolutionMessage(canonicalJid, responseText, usePreview);
    // ── 12. Actualizar cooldown tras respuesta exitosa ──────────────────────
    setCooldown(canonicalJid);
    console.log(`[BOT] Mensaje enviado a ${canonicalJid}. Cooldown activado.`);
  } catch (err) {
    // No reintentar: en el siguiente mensaje se volverá a intentar.
    console.error(
      `[BOT] Error al enviar mensaje a ${canonicalJid}:`,
      err?.response?.data || err.message
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: GET /api/config
// Retorna la configuración activa en memoria.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/config', requireAdminKey, (_req, res) => {
  res.json(config);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: POST /api/config
// Recibe un JSON, lo valida mínimamente, lo persiste en disco y actualiza
// la configuración en memoria sin reiniciar el servidor (hot-reload).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/config', requireAdminKey, (req, res) => {
  const newConfig = req.body;

  // Validación mínima de estructura
  if (typeof newConfig !== 'object' || Array.isArray(newConfig) || !newConfig) {
    return res.status(400).json({ error: 'El cuerpo debe ser un objeto JSON válido.' });
  }

  if (!Array.isArray(newConfig.faqs)) {
    return res.status(400).json({ error: 'El campo "faqs" debe ser un array.' });
  }

  if (!Array.isArray(newConfig.agentKeywords)) {
    return res.status(400).json({ error: 'El campo "agentKeywords" debe ser un array.' });
  }

  // Persistir en disco
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CONFIG] Error al escribir config.json:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la configuración en disco.' });
  }

  // Hot-reload en memoria
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
    status   : 'ok',
    uptime   : process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Arranque del servidor
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('─────────────────────────────────────────────────');
  console.log('  🤖  WhatsApp Autoresponder  |  Evolution API');
  console.log('─────────────────────────────────────────────────');
  console.log(`  ✅  Servidor escuchando en http://localhost:${PORT}`);
  console.log(`  📋  Instancia Evolution : ${EVOLUTION_INSTANCE}`);
  console.log(`  ⏱️   Cooldown             : ${config.cooldownMinutes} min`);
  console.log(`  📚  FAQs cargadas        : ${config.faqs?.length ?? 0}`);
  console.log('─────────────────────────────────────────────────');
});
