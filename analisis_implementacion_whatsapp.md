# Análisis e Implementación: WhatsApp Autoresponder (Servidor Local)

Este documento detalla la viabilidad, estrategia y el plan de acción para implementar el microservicio `whatsapp-autoresponder` utilizando un entorno local (tu propia PC) como servidor temporal para el MVP del Spa Angel Nails.

## 1. ¿Es correcta la estrategia del Microservicio?

**SÍ, es la estrategia correcta y profesional.** 
Has separado el "Autoresponder" en un microservicio (Node.js + Evolution API) que se encarga exclusivamente de WhatsApp. 
- **No sobrecarga Supabase:** El bot responde preguntas frecuentes (FAQs) leyendo un archivo `config.json` en memoria. Supabase solo se usará para guardar las reservas reales.
- **Intervención Humana:** El microservicio ya tiene configurada la lógica de silenciarse (cooldown) cuando el cliente pide hablar con un "asesor" o "humano", permitiendo que la profesional tome el control del chat.

## 2. El Hardware: ¿Sirve mi PC como servidor temporal?

**Especificaciones de tu PC:**
- **Procesador:** Intel Core i7-6500U (2.50GHz)
- **RAM:** 8 GB
- **Sistema Operativo:** Windows 64 bits

**Consumo estimado del ecosistema (Docker):**
- **Evolution API (Motor WhatsApp):** ~300 - 500 MB (Usando la conexión ligera Baileys).
- **Autoresponder (Node.js):** ~100 MB.
- **Túnel (Ngrok / Cloudflare):** ~50 MB.
- **Motor Docker (WSL2):** ~1.5 GB a 2 GB.
- **Total estimado:** ~2.5 GB a 3 GB de RAM.

**Veredicto:** **SÍ, tu PC es perfectamente capaz** de sostener este ecosistema durante una semana (e incluso más) sin problemas. Windows consumirá unos 3.5 GB, el servidor de WhatsApp unos 2.5 GB, dejándote con unos 2 GB libres. El procesador i7 manejará sin esfuerzo el tráfico de mensajes de un Spa.

### Precauciones obligatorias para tu PC durante esta semana:
Para garantizar que el Spa no sufra caídas del servicio de WhatsApp:
1. **No suspender la PC:** Configura las opciones de energía de Windows para que nunca entre en suspensión o hibernación (puedes apagar la pantalla, pero la PC debe seguir corriendo).
2. **Uso moderado:** Evita abrir juegos pesados o decenas de pestañas de Chrome al mismo tiempo.
3. **Conexión a Internet:** De preferencia, usa cable de red (Ethernet) en lugar de WiFi para evitar micro-cortes.
4. **Pausar actualizaciones:** En Windows Update, pausa las actualizaciones automáticas por 1 semana para evitar que la PC se reinicie sola de madrugada.

## 3. Plan de Implementación (Lo que vamos a hacer)

Para levantar todo esto de forma ordenada, rápida y sin ensuciar tu PC con configuraciones complejas, usaremos **Docker Compose**. Esto empaquetará todas las piezas necesarias.

### Paso 1: Preparar Docker y el Túnel
- Asegurarnos de que tienes instalado **Docker Desktop** en tu PC.
- Usar **Cloudflare Tunnels (gratis)** o **Ngrok** para crear una URL pública (ej. `https://api-spa.trycloudflare.com`) que apunte a tu computadora local. Evolution API necesita esto para enviar los webhooks a tu Node.js, y para que n8n pueda enviar notificaciones.

### Paso 2: Crear el archivo `docker-compose.yml`
Crearemos un archivo en la carpeta `whatsapp-autoresponder` que levantará los siguientes servicios al mismo tiempo con un solo comando:
1. **Evolution API:** El servidor que mantiene la conexión con WhatsApp Web.
2. **Redis:** (Opcional pero recomendado por Evolution para manejar las sesiones más rápido).
3. **Tu Autoresponder (Node.js):** Tu código actual que contiene la lógica de negocio y las respuestas del bot.

### Paso 3: Configurar las variables de entorno (`.env`)
Actualizaremos el archivo `.env` de tu autoresponder para que apunte a la instancia local de Evolution API que estará corriendo en Docker.

### Paso 4: Escanear el código QR
1. Ejecutaremos el comando `docker compose up -d`.
2. Haremos una petición a Evolution API para que genere un código QR.
3. La dueña del Spa escaneará el código con su WhatsApp Business.
4. Configuraremos el Webhook en Evolution API para que avise a tu Autoresponder cada vez que llegue un mensaje.

### Paso 5: ¡Pruebas!
Enviaremos mensajes de prueba al número del Spa. Validaremos que responda los horarios, que se silencie al pedir "asesor", y que todo funcione 24/7 (mientras la PC esté encendida).

---
*Cuando estés listo para empezar, avísame y pasamos a crear el archivo `docker-compose.yml`.*
