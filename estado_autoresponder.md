# Lista de despliegue — Angel Nails

Arquitectura: frontend en Netlify; Evolution API, autoresponder, PostgreSQL y Redis en el VPS Hostinger; empresa, usuarios, servicios y citas en Supabase.

## 1. Tener a mano

- [ ] Acceso al VPS Hostinger y una sesión SSH.
- [ ] Dominio para la API, por ejemplo `api.tudominio.com`, y acceso a su DNS.
- [ ] Acceso al proyecto Supabase y al sitio Netlify.
- [ ] URL del repositorio Git. Si es privado, configura acceso SSH desde el VPS; no pongas un token en el comando ni en este archivo.

## 2. Preparar el VPS

### 2.1 Crear Ubuntu y comprobar Docker

- [ ] En Hostinger, crea el VPS con Ubuntu LTS. Si ofrece una plantilla **Docker**, puedes seleccionarla; no instales otro panel Docker encima.
- [ ] En hPanel, copia la IPv4 pública y entra por SSH:

```bash
ssh root@IP_PUBLICA_DEL_VPS
```

- [ ] Comprueba que Docker y Compose estén instalados:

```bash
docker --version
docker compose version
sudo systemctl status docker --no-pager
```

- [ ] Si alguno no existe, instala Docker desde la plantilla oficial de Hostinger o sigue la guía oficial de Docker para Ubuntu. No continúes hasta que `docker compose version` funcione.

### 2.2 Apuntar el dominio al VPS

- [ ] En el proveedor del dominio, crea un registro DNS:
  - Tipo: `A`
  - Nombre/host: `api`
  - Valor/destino: IPv4 pública del VPS
  - TTL: automático o 300 segundos
- [ ] Si existe un registro `AAAA` para `api`, elimínalo salvo que hayas configurado IPv6 en el VPS.
- [ ] Espera la propagación y comprueba desde tu equipo:

```powershell
Resolve-DnsName api.tu-dominio.com
```

Debe aparecer la IPv4 del VPS. Reemplaza `api.tu-dominio.com` por tu subdominio real en todos los pasos siguientes.

### 2.3 Configurar los firewalls

- [ ] En el firewall de Hostinger permite tráfico entrante a `80/tcp` y `443/tcp`, además de SSH. Restringe SSH a tu IP pública si es fija.
- [ ] En Ubuntu, configura UFW. Si tu IP pública es fija, reemplaza `TU_IP_PUBLICA` por ella:

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from TU_IP_PUBLICA to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status numbered
```

- [ ] Antes de activarlo, confirma que SSH está permitido en el firewall de Hostinger y mantén abierta esta sesión. Luego activa UFW y verifica con una segunda conexión SSH:

```bash
sudo ufw enable
sudo ufw status verbose
```

Si tu IP cambia con frecuencia, no limites SSH a una IP que pueda cambiar: confirma primero cómo recuperar el acceso desde hPanel.

- [ ] No abras públicamente `3100`, `8480`, `5432` ni `6379`. Compose los enlaza a loopback o a la red interna de Docker; el único acceso público a la API será HTTPS por Caddy.

### 2.4 Instalar Caddy y habilitar HTTPS

Haz esto después de que DNS resuelva a la IP del VPS y de permitir `80/tcp` y `443/tcp` en ambos firewalls. En Ubuntu, instala el paquete oficial de Caddy:

```bash
sudo apt install --yes debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

- [ ] Escribe la configuración de Caddy, sustituyendo el dominio:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.tu-dominio.com {
    reverse_proxy 127.0.0.1:3100
}
EOF
```

- [ ] Valida y recarga Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy obtiene y renueva el certificado TLS automáticamente cuando el DNS y los puertos están correctamente configurados. Revisa sus logs con `sudo journalctl -u caddy -n 100 --no-pager` si la validación HTTPS falla.

### 2.5 Activar y probar copias

- [ ] En hPanel, activa los backups automáticos del VPS y confirma la fecha de la primera copia.
- [ ] La base PostgreSQL de este Compose conserva datos internos de Evolution, incluida la instancia; Supabase contiene por separado las citas y datos del negocio. Configura copias de Supabase según su plan.
- [ ] Tras arrancar Compose, crea un dump de PostgreSQL y guárdalo fuera del directorio del proyecto:

```bash
mkdir -p ~/backups
docker compose exec -T postgres pg_dump -U postgres -d evolution -Fc > ~/backups/evolution_$(date +%F).dump
ls -lh ~/backups
```

- [ ] Copia el dump periódicamente a un destino fuera del VPS (equipo seguro u almacenamiento externo) y comprueba que el archivo no esté vacío.
- [ ] Conserva los volúmenes `postgres_data`, `redis_data` y `bot_config`. **No ejecutes `docker compose down -v`**: borraría los datos persistentes.

## 3. Subir el proyecto y configurar secretos

```bash
git clone <URL_DEL_REPOSITORIO>
cd remix-app/whatsapp-autoresponder
cp .env.example .env
```

- [ ] Completar `whatsapp-autoresponder/.env` directamente en el VPS.
- [ ] Generar valores secretos distintos; para claves hexadecimales usa `openssl rand -hex 32`. No reutilices la clave demo anterior.
- [ ] Completar: `POSTGRES_PASSWORD`, `ADMIN_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`, `BOOKING_LINK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ADMIN_USER_ID`, `EVOLUTION_INSTANCE_NAME` y `FRONTEND_ORIGINS`.
- [ ] En `FRONTEND_ORIGINS`, dejar solo los orígenes reales que usarás, por ejemplo `https://angelnailsagenda.netlify.app` y, si aplica, el dominio propio del frontend.
- [ ] No incluir secretos en `VITE_*`; esas variables terminan dentro del JavaScript público.
- [ ] No copiar el `.env` del equipo local al repositorio ni pegar secretos en este chat.

El Compose configura las conexiones internas a Evolution y el webhook. El endpoint público que usará el frontend es `https://api.tudominio.com`.

## 4. Respaldar y migrar Supabase

- [ ] Hacer un respaldo de Supabase antes de migrar una base existente.
- [ ] Si la base está vacía, ejecutar primero `database.sql`. Si ya tiene tablas y datos, no volver a ejecutar ese script: revisar el esquema y los duplicados antes de continuar.
- [ ] Ejecutar en Supabase SQL Editor, en este orden:
  1. `supabase/migrations/20260926_align_runtime_schema.sql`
  2. `supabase/migrations/20260926_atomic_booking_operations.sql`
  3. `supabase/migrations/20260926_lock_down_public_appointment_tables.sql`
  4. `supabase/migrations/20261002_restrict_public_empresa_columns.sql`
- [ ] No aplicar el paso 3 hasta que el microservicio esté configurado con `SUPABASE_SERVICE_ROLE_KEY` y `BOOKING_LINK_SECRET`; sin ambos, las reservas seguras fallarán.

## 5. Arrancar el microservicio

En el VPS, dentro de `whatsapp-autoresponder`:

```bash
docker compose config -q
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 whatsapp-bot evolution
```

- [ ] Confirmar que PostgreSQL, Redis, Evolution y `whatsapp-bot` estén activos.
- [ ] Probar localmente en el VPS: `curl http://127.0.0.1:3100/health` debe devolver `{"status":"ok",...}`.
- [ ] Probar desde tu equipo `https://api.tudominio.com/health`.
- [ ] Si falla, detenerse y revisar `docker compose logs`; no abrir puertos de bases de datos como solución rápida.

## 6. Publicar frontend y conectar WhatsApp

- [ ] En Netlify configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_NEGOCIO_USER_ID` y `VITE_AUTORESPONDER_URL=https://api.tudominio.com`.
- [ ] Confirmar que no existan `VITE_EVOLUTION_KEY` ni `VITE_EVOLUTION_URL` en las variables de build de Netlify. Si una clave de Evolution se publicó alguna vez, rotarla antes de continuar.
- [ ] Volver a desplegar Netlify después de guardar variables.
- [ ] Abrir **Panel > Configuración > WhatsApp** y crear/conectar la instancia. Al crearla, el backend configura el webhook firmado.
- [ ] Escanear el QR con el WhatsApp del negocio. Si se está migrando una sesión conectada en otro servidor, no borrar ni cerrar la sesión antigua hasta confirmar el procedimiento de migración.
- [ ] Si la instancia ya existía antes de este cambio, consultar en `README.md` el comando para volver a registrar su webhook firmado; ejecutarlo en el VPS y escribir los secretos directamente en la terminal.

## 7. Prueba antes de entregar

- [ ] Desde un teléfono distinto, enviar un mensaje de prueba al WhatsApp conectado.
- [ ] Confirmar respuesta automática con enlace firmado.
- [ ] Abrir el enlace en el teléfono y revisar que carguen empresa, servicios y horarios.
- [ ] Crear una cita de prueba en un horario libre.
- [ ] Confirmar que aparece en el panel y en Supabase; cancelarla después de la prueba.
- [ ] Reiniciar solo los contenedores (`docker compose restart`) y comprobar que Evolution mantiene la instancia conectada y que siguen existiendo los datos.
- [ ] Dejar configuradas copias periódicas y una forma de recibir avisos si `/health` deja de responder.

**No entregar todavía** hasta que todos los checks de este runbook estén completos. El `.env` local actual no tiene los secretos de producción requeridos.
