<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f657330c-af3d-477d-aae0-f2fa3fc48998

## Run Locally
# 💅 Angel Nails — Sistema de Reservas

> Plataforma completa de gestión de citas y reservas online para salones de belleza y profesionales de uñas.

---

## ¿Qué es?

Angel Nails es una aplicación web moderna que consta de **dos partes** bien diferenciadas:

| Parte | Quién la usa | Para qué |
|---|---|---|
| **Panel Administrativo** | La profesional / dueña del negocio | Gestionar citas, servicios, horarios y configuración |
| **Portal de Reservas (PWA)** | Los clientes finales | Reservar una cita en menos de 2 minutos |

El cliente solo necesita abrir un enlace en su teléfono — **sin descargar ninguna app, sin crear cuenta, sin contraseña**.

---

## ¿Cómo funciona para el cliente?

El proceso de reserva es un flujo guiado paso a paso:

```
1. Elige el servicio   →   2. Elige la fecha   →   3. Elige la hora
        ↓
4. Escribe tu nombre y WhatsApp   →   5. Confirma   →   ✅ ¡Listo!
```

Inmediatamente después de confirmar:
- El **cliente recibe un WhatsApp** con los detalles de su cita.
- La **profesional recibe una notificación por WhatsApp** con los datos del nuevo cliente.

---

## ¿Cómo funciona para la profesional?

La profesional accede a su **panel privado** con usuario y contraseña. Desde ahí puede:

### 📊 Dashboard
Vista general del negocio con las citas del día, próximas reservas y resumen de actividad.

### 📅 Calendario
Vista de calendario completa donde se ven todas las citas agendadas, con opción de crear citas manualmente directamente desde el calendario.

### 🗂️ Gestión de Citas
Listado detallado de todas las citas, con filtros por estado:
- **Agendada** — cita confirmada pendiente.
- **Completada** — servicio ya realizado.
- **Cancelada** — cita cancelada.

### ✂️ Servicios
Gestión del catálogo de servicios:
- Crear, editar y desactivar servicios.
- Definir el **precio** y la **duración en minutos** de cada servicio.
- Solo los servicios activos aparecen disponibles para los clientes.

### 🏢 Empresa
Datos del negocio: nombre, dirección, logo, colores corporativos y descripción. Esta información se muestra a los clientes durante el proceso de reserva.

### ⚙️ Configuración
Control de horarios de atención:
- Configurar qué días de la semana trabaja la profesional.
- Definir la hora de apertura y cierre por día.
- Crear **bloqueos de agenda** para días o franjas horarias no disponibles (vacaciones, eventos, descansos).

---

## Lógica de disponibilidad inteligente

El sistema calcula automáticamente los horarios disponibles teniendo en cuenta:

- ✅ Horario laboral configurado por la profesional.
- ✅ Citas ya existentes (no se puede reservar encima de otra cita).
- ✅ Bloqueos de agenda (días libres, vacaciones, etc.).
- ✅ Duración del servicio (si el servicio dura 90 min y el cierre es a las 18:00, no se ofrecen horarios a las 17:30).

**Además**, cuando el cliente pulsa "Confirmar", el sistema vuelve a verificar la disponibilidad en tiempo real — protegiendo contra el caso de que dos personas intenten reservar el mismo horario a la vez.

---

## Portal de Reservas — detalle de pantallas

### Menú principal
Al abrir el enlace, el cliente ve un menú con opciones claras:
- **Agendar una cita** — flujo principal de reserva.
- **Consultar mi cita** — para ver o cancelar una cita existente (usando su número de WhatsApp).
- **Ver servicios y precios** — catálogo informativo sin necesidad de reservar.
- **Información del negocio** — dirección, horarios, datos de contacto.

### Pantalla 1 — Servicio
Lista de servicios activos con nombre, precio y duración. El cliente selecciona el que desea.

### Pantalla 2 — Fecha
Calendario interactivo que solo muestra los días disponibles. Los días sin atención y los días bloqueados aparecen desactivados.

### Pantalla 3 — Hora
Lista de horarios libres para esa fecha y servicio. Solo aparecen las horas realmente disponibles.

### Pantalla 4 — Datos del cliente
Formulario sencillo: solo **nombre** y **número de WhatsApp**. Sin contraseñas, sin registro.

### Pantalla 5 — Resumen y confirmación
Vista previa completa de la cita antes de confirmar:

```
Servicio:   Manicure
Fecha:      Viernes 12 de septiembre
Hora:       15:30
Nombre:     María García
WhatsApp:   +57 300 000 0000
```

### Pantalla 6 — Éxito
Confirmación visual de que la cita fue creada correctamente.

---

## Gestión de clientes

Cuando un cliente reserva por primera vez, queda registrado automáticamente en la base de datos. Si el mismo número de WhatsApp ya existe, el sistema lo reconoce y no crea duplicados.

---

## Tecnología utilizada

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript |
| Bundler / PWA | Vite + vite-plugin-pwa |
| Estilos | Tailwind CSS 4 |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Notificaciones | WhatsApp vía n8n |
| Seguridad | Row Level Security (RLS) en todas las tablas |

---

## Arquitectura general

```
         CLIENTE (teléfono / navegador)
                     │
                     ▼
              Portal de Reservas
                (PWA pública)
                     │
                     ▼
                 SUPABASE
          ┌──────────────────┐
          │  servicios       │
          │  horarios        │
          │  bloqueos        │
          │  citas           │
          │  clientes        │
          └────────┬─────────┘
                   │
              cita creada
                   │
                   ▼
                  n8n
           ┌──────┴──────┐
           ▼              ▼
      WhatsApp        WhatsApp
      Cliente        Profesional

         PANEL ADMINISTRATIVO
         (acceso con usuario y contraseña)
                     │
                     ▼
                 SUPABASE
```

---

## Seguridad

- Todas las tablas de la base de datos tienen **Row Level Security (RLS)** activado.
- La profesional solo puede ver y modificar **sus propios datos**.
- El portal de reservas puede leer servicios y horarios, pero **solo puede insertar citas** — no puede leer datos de otras personas ni modificar configuraciones.
- La verificación de disponibilidad ocurre **tanto en el frontend como en el backend** antes de confirmar cualquier cita.

---

## Lo que NO incluye esta versión (MVP)

Esta primera versión está diseñada para ser simple, rápida y confiable. Las siguientes funcionalidades están previstas para versiones futuras:

- [ ] Multi-empresa / multi-profesional
- [ ] Pagos online
- [ ] Recordatorios automáticos previos a la cita
- [ ] IA conversacional por WhatsApp
- [ ] App nativa para iOS / Android
- [ ] Sistema de fidelización y promociones
- [ ] Historial avanzado del cliente

---

## Roadmap futuro

```
MVP Actual
 ├── Portal de reservas PWA
 ├── Panel administrativo
 ├── Supabase (base de datos)
 └── n8n (notificaciones WhatsApp)

Versión 2
 ├── Recordatorios automáticos
 ├── Cancelación y reprogramación
 └── Notificaciones avanzadas

Versión 3
 ├── IA por WhatsApp
 ├── Recomendación de servicios
 └── Agendamiento conversacional

Versión 4
 └── Multi-negocio (SaaS)
```

---

> **Resumen en una frase:**
> Angel Nails permite que cualquier cliente reserve una cita desde su teléfono en menos de 2 minutos, mientras la profesional gestiona toda su agenda desde un panel web limpio y profesional.
