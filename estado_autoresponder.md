# Preparación para producción — Angel Nails

## Arquitectura

- Frontend React/Vite publicado en Netlify.
- VPS Hostinger con Evolution API, el autoresponder Node.js, PostgreSQL y Redis en Docker Compose.
- Supabase para autenticación, empresa, servicios y citas.

El autoresponder genera enlaces de reserva firmados. Evolution debe llamar al webhook con un JWT HS256 configurado mediante `headers.jwt_key`. Las instancias nuevas creadas desde el panel reciben esta configuración automáticamente.

## Pendiente antes del primer despliegue

1. Configurar un dominio HTTPS para la API y añadir su origen exacto a `FRONTEND_ORIGINS`.
2. Crear `whatsapp-autoresponder/.env` en el VPS a partir de `.env.example`. Definir valores aleatorios nuevos para `POSTGRES_PASSWORD`, `ADMIN_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` y `BOOKING_LINK_SECRET`.
3. Completar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `WHATSAPP_ADMIN_USER_ID` en el entorno server-side. No publicar ni enviar aquí esos valores.
4. Configurar `VITE_AUTORESPONDER_URL=https://api.tu-dominio.com` en Netlify y volver a desplegar el frontend.
5. Ejecutar las migraciones de `supabase/migrations` en el orden indicado en el README. El bloqueo de tablas de citas requiere que el microservicio ya tenga el `service_role` y el secreto de reserva.

Las variables `VITE_*` se incorporan al JavaScript público. Nunca pongas en ellas la clave de Evolution, el `service_role`, `BOOKING_LINK_SECRET` o `EVOLUTION_WEBHOOK_SECRET`.

## Arranque del VPS

Desde `whatsapp-autoresponder`:

```bash
docker compose config -q
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 whatsapp-bot evolution
```

Compose enlaza el bot y Evolution solo a loopback; el reverse proxy HTTPS del VPS publica el bot en el dominio configurado. PostgreSQL conserva la sesión de Evolution y los volúmenes mantienen los datos y la configuración.

## Instancia de WhatsApp ya existente

Si la instancia se creó antes de desplegar el cambio del webhook firmado, vuelve a registrarlo. Ejecuta este comando directamente en PowerShell en el VPS y reemplaza los marcadores allí; no guardes los secretos en este archivo:

```powershell
$body = @{
   webhook = @{
      enabled = $true
      url = 'http://whatsapp-bot:3000/webhook/evolution'
      headers = @{ jwt_key = '<EVOLUTION_WEBHOOK_SECRET>' }
      byEvents = $false
      base64 = $false
      events = @('MESSAGES_UPSERT')
   }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Uri 'http://127.0.0.1:8480/webhook/set/spa-angel-nails' `
   -Method Post `
   -Headers @{ apikey = '<EVOLUTION_API_KEY>' } `
   -ContentType 'application/json' `
   -Body $body
```

## Prueba funcional

Desde un teléfono distinto, envía un mensaje al WhatsApp conectado. Comprueba que responda con el enlace firmado, ábrelo y completa una reserva de prueba. Verifica luego la cita en el panel y en Supabase. No uses una reserva real para la primera prueba.
