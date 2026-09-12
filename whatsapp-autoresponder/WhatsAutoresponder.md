# 🤖 WhatsApp Autoresponder
### Guía de Uso e Integración con Evolution API

> **Microservicio** contestador automático de WhatsApp, diseñado para responder
> mensajes entrantes con FAQs configurables, cooldown por usuario y detección
> de solicitudes de atención humana.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![Evolution API](https://img.shields.io/badge/Evolution_API-compatible-25D366?logo=whatsapp&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

---

## 📋 Tabla de Contenidos

1. [Arquitectura general](#1-arquitectura-general)
2. [Configuración inicial — `.env`](#2-configuración-inicial--env)
3. [Registrar el Webhook en Evolution API](#3-registrar-el-webhook-en-evolution-api)
4. [Personalizar `config.json`](#4-personalizar-configjson)
5. [Flujo de decisión de mensajes](#5-flujo-de-decisión-de-mensajes)
6. [Endpoints disponibles](#6-endpoints-disponibles)
7. [Integración con un proyecto real](#7-integración-con-un-proyecto-real)
8. [Despliegue con Docker](#8-despliegue-con-docker)
9. [Resumen de archivos clave](#9-resumen-de-archivos-clave)

---

## 1. Arquitectura general

El microservicio **nunca** habla directamente con WhatsApp.  
Solo se comunica con **Evolution API**, que es quien mantiene la sesión activa.

```
┌─────────────────────┐
│  WhatsApp usuarios  │
└──────────┬──────────┘
           │  (mensajes)
           ▼
┌─────────────────────┐
│   Evolution API     │  :8080  ← gestiona la sesión de WhatsApp
└──────────┬──────────┘
           │  webhook POST /webhook/evolution
           ▼
┌─────────────────────────────────────────────────┐
│         Este microservicio  :3000               │
│                                                 │
│  ├── config.json  (FAQs · cooldown · keywords)  │
│  └── POST /message/sendText → Evolution API     │
└─────────────────────────────────────────────────┘
```

---

## 2. Configuración inicial — `.env`

Copia la plantilla y rellena cada variable:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor de ejemplo |
|:---|:---|:---|
| `PORT` | Puerto en que escucha Express | `3000` |
| `ADMIN_API_KEY` | Clave secreta para los endpoints `/api/config` | `mi_clave_admin_123` |
| `EVOLUTION_API_URL` | URL base de tu instancia de Evolution API | `http://localhost:8080` |
| `EVOLUTION_API_KEY` | API Key de Evolution API | `evo_abc123xyz` |
| `EVOLUTION_INSTANCE_NAME` | Nombre de la instancia conectada a WhatsApp | `mi-negocio` |

> [!IMPORTANT]
> `ADMIN_API_KEY` es **obligatoria**. Si no se define, los endpoints de administración devuelven `503 Service Unavailable` por seguridad.

---

## 3. Registrar el Webhook en Evolution API

Evolution API necesita saber a dónde enviar los eventos de mensajes entrantes.  
Ejecuta este comando **una sola vez** (o cada vez que cambie la URL del servidor):

```bash
curl -X PUT http://localhost:8080/webhook/set/mi-negocio \
  -H "apikey: evo_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://TU_SERVIDOR:3000/webhook/evolution",
    "enabled": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

### 🔌 Desarrollo local → exponer con ngrok

Si el microservicio corre en tu máquina, necesitas una URL pública:

```bash
# 1. Instala ngrok: https://ngrok.com/download
# 2. Expón el puerto local
ngrok http 3000
# → Forwarding: https://abc123.ngrok-free.app → localhost:3000

# 3. Usa esa URL en el curl de arriba:
#    "url": "https://abc123.ngrok-free.app/webhook/evolution"
```

---

## 4. Personalizar `config.json`

Este archivo controla **todo el comportamiento del bot** y puede actualizarse
**en caliente** vía la API de administración, sin necesidad de reiniciar el servidor.

```jsonc
{
  // ⏱ Minutos que el bot espera antes de volver a responder al mismo usuario
  "cooldownMinutes": 10,

  // 👤 Si el usuario escribe alguna de estas palabras → el bot se silencia
  //    para que un agente humano pueda tomar el chat
  "agentKeywords": ["agente", "asesor", "persona", "humano", "hablar con"],

  // 📚 Preguntas frecuentes — se evalúan en orden, gana la primera que coincide
  "faqs": [
    {
      "id": "horarios",
      "keywords": ["horario", "horarios", "abren", "cierran", "atienden"],
      "message": "🕐 *Nuestro horario de atención:*\nLunes a Viernes: 8:00 AM – 6:00 PM\nSábados: 9:00 AM – 1:00 PM",
      "link": ""     // opcional: se agrega como segunda línea al final del mensaje
    },
    {
      "id": "precios",
      "keywords": ["precio", "costo", "cuanto", "tarifa", "valor"],
      "message": "💰 Consulta nuestro catálogo actualizado:",
      "link": "https://tudominio.com/precios"
    }
  ],

  // 🤖 Respuesta cuando NINGUNA FAQ coincide con el mensaje recibido
  "defaultSelfService": {
    "enabled": true,
    "message": "👋 ¡Hola! Gracias por contactarnos.\n\nEscribe *agente* para hablar con una persona. 😊",
    "link": "https://tudominio.com/autoservicio",
    "linkPreview": true
  }
}
```

### Campos de cada FAQ

| Campo | Tipo | Descripción |
|:---|:---|:---|
| `id` | `string` | Identificador único (solo para logs) |
| `keywords` | `string[]` | Palabras clave que activan esta FAQ (sin tildes, case-insensitive) |
| `message` | `string` | Texto que se envía al usuario. Soporta *negrita* de WhatsApp |
| `link` | `string` | URL opcional que se agrega al final del mensaje |

---

## 5. Flujo de decisión de mensajes

Cada mensaje entrante pasa por esta cadena de filtros antes de ser respondido:

```
📨 Mensaje recibido  →  POST /webhook/evolution
              │
              ├─ ¿event ≠ messages.upsert? ────────────────→ 🚫 Ignorar
              │
              ├─ ¿fromMe = true? ──────────────────────────→ 🚫 Ignorar (mensaje propio)
              │
              ├─ ¿Es grupo (@g.us) o canal (@newsletter)? ─→ 🚫 Ignorar
              │
              ├─ ¿Contiene agentKeyword? ──────────────────→ 🔕 Silenciar bot
              │                                               (liberar cooldown)
              ├─ ¿Usuario en cooldown? ────────────────────→ 🚫 Ignorar
              │
              ├─ ¿Coincide con alguna FAQ? ────────────────→ ✅ Responder con FAQ
              │
              └─ (sin coincidencia) ───────────────────────→ ✅ Responder con
                                                              defaultSelfService
                                                              + activar cooldown
```

---

## 6. Endpoints disponibles

### `POST /webhook/evolution`

Recibe los eventos de Evolution API. **No requiere autenticación** (la invoca Evolution, no tu código).

---

### `GET /health`

Verifica que el servidor esté en línea. Ideal para health checks de Docker / Kubernetes.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "uptime": 123.4,
  "timestamp": "2026-09-09T20:00:00.000Z"
}
```

---

### `GET /api/config` &nbsp;🔒 requiere `x-api-key`

Devuelve la configuración activa **en memoria** (puede diferir del disco si hubo hot-reload).

```bash
curl http://localhost:3000/api/config \
  -H "x-api-key: mi_clave_admin_123"
```

---

### `POST /api/config` &nbsp;🔒 requiere `x-api-key`

Actualiza la configuración **en caliente**: persiste en `config.json` y recarga la memoria,
**sin reiniciar el servidor**.

```bash
curl -X POST http://localhost:3000/api/config \
  -H "x-api-key: mi_clave_admin_123" \
  -H "Content-Type: application/json" \
  -d @config.json
```

```json
{ "ok": true, "message": "Configuración actualizada exitosamente." }
```

> [!TIP]
> Este endpoint es la pieza clave de integración: tu backend principal puede actualizar FAQs, horarios y mensajes **dinámicamente desde una base de datos**, sin intervención manual en el servidor del bot.

---

## 7. Integración con un proyecto real

### Escenario A — Backend sincroniza FAQs desde la base de datos

```js
// backend-principal/services/bot.service.js

async function syncFaqsToBot(db) {
  // 1. Leer FAQs activas desde tu BD
  const faqs = await db.query('SELECT * FROM faqs WHERE activo = true');

  // 2. Enviar al bot vía hot-reload
  await fetch('http://bot-service:3000/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.BOT_ADMIN_KEY,
    },
    body: JSON.stringify({
      cooldownMinutes: 10,
      agentKeywords: ['agente', 'asesor', 'humano'],
      faqs: faqs.map(f => ({
        id:       f.slug,
        keywords: f.keywords.split(','),
        message:  f.respuesta,
        link:     f.url ?? '',
      })),
      defaultSelfService: {
        enabled:     true,
        message:     '👋 ¡Hola! Escribe *agente* para hablar con nosotros.',
        link:        'https://tudominio.com',
        linkPreview: true,
      },
    }),
  });
}
```

---

### Escenario B — Notificar al CRM cuando un usuario pide un agente humano

El bot silencia su respuesta al detectar una `agentKeyword`, pero no notifica a nadie
por defecto. Para integrarlo con tu sistema, extiende el handler en
[`index.js` (línea ~283)](file:///c:/JDV/01_Development/Por%20Revisar/whatsapp-autoresponder/index.js#L279-L289):

```js
if (wantsAgent) {
  cooldownMap.delete(canonicalJid);

  // 👇 Notifica a tu CRM/backend
  await axios.post('https://tu-backend.com/api/crm/agent-requested', {
    jid:       canonicalJid,
    timestamp: new Date().toISOString(),
  }, {
    headers: { Authorization: `Bearer ${process.env.CRM_TOKEN}` },
  });

  return;
}
```

---

### Escenario C — Arquitectura de producción recomendada

```
                    ┌─────────────────────────┐
                    │       Tu Backend        │
                    │  (NestJS / Laravel /    │
                    │   Express / Django...)  │
                    └───────────┬─────────────┘
                                │ POST /api/config  (hot-reload de FAQs)
                                ▼
 ┌──────────────┐  webhook   ┌──────────────────────────┐
 │ Evolution    │ ─────────▶ │   whatsapp-autoresponder │
 │  API :8080   │ ◀───────── │         :3000            │
 └──────────────┘ sendMessage└──────────────────────────┘
        ↕
 [WhatsApp usuarios]
```

---

## 8. Despliegue con Docker

El proyecto incluye un `Dockerfile` listo para producción.

### Imagen standalone

```bash
# Construir la imagen
docker build -t whatsapp-bot .

# Ejecutar
docker run -d \
  --name whatsapp-bot \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/config.json:/app/config.json \
  whatsapp-bot
```

> [!NOTE]
> El volumen `-v config.json:/app/config.json` hace que los cambios vía `POST /api/config`
> persistan en disco **fuera del contenedor**, sobreviviendo reinicios.

---

### Docker Compose (con Evolution API)

```yaml
# docker-compose.yml
services:

  evolution:
    image: atendai/evolution-api:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - API_KEY=evo_abc123xyz

  whatsapp-bot:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./config.json:/app/config.json
    depends_on:
      - evolution
```

```bash
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f whatsapp-bot
```

---

## 9. Resumen de archivos clave

| Archivo | Propósito |
|:---|:---|
| [`index.js`](file:///c:/JDV/01_Development/Por%20Revisar/whatsapp-autoresponder/index.js) | Servidor Express + toda la lógica del bot (webhook, cooldown, FAQs, API admin) |
| [`config.json`](file:///c:/JDV/01_Development/Por%20Revisar/whatsapp-autoresponder/config.json) | FAQs, cooldown y keywords — editable en caliente vía API |
| [`.env.example`](file:///c:/JDV/01_Development/Por%20Revisar/whatsapp-autoresponder/.env.example) | Plantilla de variables de entorno (copiar a `.env`) |
| [`Dockerfile`](file:///c:/JDV/01_Development/Por%20Revisar/whatsapp-autoresponder/Dockerfile) | Imagen Docker lista para producción |

---

<div align="center">

*📅 Generado el 2026-09-09 &nbsp;·&nbsp; WhatsApp Autoresponder + Evolution API*

</div>
