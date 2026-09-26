# 🤖 WhatsApp Autoresponder · Evolution API

Microservicio Node.js/Express que actúa como contestador automático de WhatsApp integrado con [Evolution API](https://doc.evolution-api.com/). Responde automáticamente a mensajes entrantes con base en FAQs configurables, detecta solicitudes de atención humana y evita el spam mediante un sistema de cooldown.

---

## ✨ Características

| Feature | Detalle |
|---|---|
| **Webhook Evolution API** | Procesa eventos `messages.upsert` en tiempo real |
| **FAQs configurables** | Respuestas automáticas por palabras clave |
| **Detección de agente** | Silencia el bot si el usuario pide un humano |
| **Cooldown inteligente** | Evita respuestas repetitivas (configurable en minutos) |
| **Soporte LID de Meta** | Maneja la migración `@s.whatsapp.net` → `@lid` |
| **Hot-reload de config** | Actualiza la configuración sin reiniciar el servidor |
| **API de administración** | Endpoints REST protegidos con API key |
| **Docker ready** | Imagen multi-stage con usuario no-root y healthcheck |

---

## 📁 Estructura del proyecto

```
whatsapp-autoresponder/
├── index.js          # Servidor Express + lógica del bot
├── config.json       # Configuración de FAQs, keywords y cooldown
├── package.json      # Dependencias del proyecto
├── .env.example      # Plantilla de variables de entorno
├── Dockerfile        # Imagen Docker multi-stage (producción)
└── README.md         # Este archivo
```

---

## 🚀 Instalación y ejecución local

### Prerrequisitos

- **Node.js** ≥ 18.x ([descargar](https://nodejs.org))
- **Evolution API** corriendo y configurada (con al menos una instancia conectada)

### Pasos

```bash
# 1. Clonar / copiar el proyecto
cd whatsapp-autoresponder

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de entorno
cp .env.example .env
```

Edita `.env` con tus valores reales:

```env
PORT=3000
ADMIN_API_KEY=mi_clave_super_secreta
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=mi_api_key_evolution
EVOLUTION_INSTANCE_NAME=mi_instancia
```

```bash
# 4. Arrancar el servidor
npm start

# Desarrollo con auto-reinicio (nodemon)
npm run dev
```

Deberías ver en consola:

```
─────────────────────────────────────────────────
  🤖  WhatsApp Autoresponder  |  Evolution API
─────────────────────────────────────────────────
  ✅  Servidor escuchando en http://localhost:3000
  📋  Instancia Evolution : mi_instancia
  ⏱️   Cooldown             : 10 min
  📚  FAQs cargadas        : 4
─────────────────────────────────────────────────
```

---

## ⚙️ Configuración (`config.json`)

### Campos principales

| Campo | Tipo | Descripción |
|---|---|---|
| `cooldownMinutes` | `number` | Tiempo de espera entre respuestas al mismo usuario |
| `agentKeywords` | `string[]` | Palabras que activan el modo "atención humana" |
| `faqs` | `FAQ[]` | Lista de preguntas frecuentes con sus respuestas |
| `defaultSelfService` | `object` | Respuesta por defecto cuando no hay FAQ coincidente |

### Estructura de una FAQ

```json
{
  "id": "horarios",
  "keywords": ["horario", "horarios", "abren"],
  "message": "🕐 Atendemos de Lunes a Viernes de 8am a 6pm.",
  "link": "https://tudominio.com/horarios"
}
```

### `defaultSelfService`

```json
{
  "enabled": true,
  "message": "👋 Hola, visita nuestro portal de autoservicio:",
  "link": "https://tudominio.com/autoservicio",
  "linkPreview": true
}
```

---

## 🔗 Configurar el Webhook en Evolution API

En tu instancia de Evolution API, configura el webhook apuntando a:

```
POST http://<tu-servidor>:3000/webhook/evolution
```

> **Tip:** Puedes usar [ngrok](https://ngrok.com/) para exponer tu localhost durante el desarrollo:
> ```bash
> ngrok http 3000
> # Copia la URL https://xxxx.ngrok.io/webhook/evolution
> ```

Asegúrate de que el evento **`messages.upsert`** esté habilitado en la configuración del webhook de tu instancia.

---

## 🛡️ API de Administración

Los endpoints de administración requieren la cabecera:

```
x-api-key: <valor de ADMIN_API_KEY>
```

### `GET /api/config`

Devuelve la configuración activa en memoria.

```bash
curl -H "x-api-key: mi_clave" http://localhost:3000/api/config
```

**Respuesta:**
```json
{
  "cooldownMinutes": 10,
  "agentKeywords": ["agente", "asesor"],
  "faqs": [...],
  "defaultSelfService": {...}
}
```

---

### `POST /api/config`

Actualiza la configuración **en caliente** (sin reiniciar el servidor). El nuevo JSON se persiste en `config.json`.

```bash
curl -X POST \
  -H "x-api-key: mi_clave" \
  -H "Content-Type: application/json" \
  -d @config.json \
  http://localhost:3000/api/config
```

**Respuesta:**
```json
{ "ok": true, "message": "Configuración actualizada exitosamente." }
```

---

### `GET /health`

Endpoint de salud (sin autenticación). Útil para Docker/K8s.

```bash
curl http://localhost:3000/health
# { "status": "ok", "uptime": 123.45, "timestamp": "..." }
```

---

## 🐳 Docker

### Build y ejecución

```bash
# Construir imagen
docker build -t whatsapp-autoresponder .

# Ejecutar con variables de entorno
docker run -d \
  --name wa-bot \
  -p 3000:3000 \
  --env-file .env \
  whatsapp-autoresponder
```

### Volumen para config persistente

Si quieres que los cambios de configuración vía API sobrevivan reinicios del contenedor:

```bash
docker run -d \
  --name wa-bot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/config.json:/app/config.json \
  whatsapp-autoresponder
```

---

## 🧠 Flujo de lógica del webhook

```
Mensaje entrante
     │
     ├─ ¿Evento es messages.upsert?  ──NO──► Ignorar
     │
     ├─ ¿fromMe === true?            ──SÍ──► Ignorar
     │
     ├─ ¿Es grupo o canal?           ──SÍ──► Ignorar
     │
     ├─ Obtener JID canónico (LID support)
     │
     ├─ ¿Es texto plano?             ──NO──► Ignorar
     │
     ├─ Normalizar texto (minúsculas + sin tildes)
     │
     ├─ ¿Contiene agentKeywords?     ──SÍ──► Silenciar bot, eliminar cooldown
     │
     ├─ ¿Está en cooldown?           ──SÍ──► Ignorar
     │
     ├─ ¿Coincide con FAQ?           ──SÍ──► Usar respuesta de FAQ
     │                               ──NO──► Usar defaultSelfService
     │
     └─ Enviar mensaje via Evolution API → Actualizar cooldown
```

---

## 📦 Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `PORT` | No (default: 3000) | Puerto del servidor |
| `ADMIN_API_KEY` | **Sí** | Clave para endpoints de administración |
| `EVOLUTION_API_URL` | **Sí** | URL base de tu Evolution API |
| `EVOLUTION_API_KEY` | **Sí** | API Key de Evolution API |
| `EVOLUTION_INSTANCE_NAME` | **Sí** | Nombre de la instancia en Evolution API |
| `SUPABASE_URL` | **Sí** | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | **Sí** | Clave anon para validar sesiones del panel |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Clave server-side para citas, clientes y bot |
| `WHATSAPP_ADMIN_USER_ID` | **Sí** | UUID del propietario autorizado |
| `BOOKING_LINK_SECRET` | **Sí** | Secreto largo para firmar enlaces de reserva |
| `FRONTEND_ORIGINS` | **Sí** | Orígenes del frontend separados por comas |

---

## 📄 Licencia

MIT
