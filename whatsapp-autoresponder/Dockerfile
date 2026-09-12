# ─── Etapa 1: Imagen base ─────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Metadatos de la imagen
LABEL maintainer="tu@email.com"
LABEL description="WhatsApp Autoresponder · Evolution API"

# ─── Etapa 2: Dependencias de producción ──────────────────────────────────────
FROM base AS deps

WORKDIR /app

# Copiar sólo manifiestos para aprovechar la caché de capas de Docker
COPY package.json package-lock.json* ./

# Instalar únicamente dependencias de producción
RUN npm ci --omit=dev

# ─── Etapa 3: Imagen final ────────────────────────────────────────────────────
FROM base AS runner

# Crear usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar dependencias instaladas desde la etapa anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente
COPY index.js   ./index.js
COPY config.json ./config.json

# Usar usuario no-root
USER appuser

# Variables de entorno por defecto (sobreescribibles con --env-file o -e)
ENV PORT=3000 \
    NODE_ENV=production

# Exponer el puerto
EXPOSE 3000

# Healthcheck nativo de Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "index.js"]
