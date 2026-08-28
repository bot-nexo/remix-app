# 💅 Angel Nails — Plan MVP de Reservas

## 1. Objetivo

Crear una **PWA/web de reservas para clientes** que permita:

1. Ver los servicios disponibles.
2. Seleccionar un servicio.
3. Seleccionar una fecha.
4. Ver únicamente los horarios disponibles.
5. Introducir nombre y WhatsApp.
6. Confirmar la cita.
7. Guardar la cita en Supabase.
8. Enviar una notificación de confirmación por WhatsApp al cliente.
9. Enviar una notificación de nueva cita por WhatsApp a la profesional.

### Decisión importante

**NO vamos a hacer el agendamiento conversacional en n8n.**

La PWA será responsable de la experiencia de reserva.

Supabase será la fuente de verdad.

n8n se utilizará posteriormente para automatizaciones y notificaciones.

---

# 2. Arquitectura

```text
                    CLIENTE
                       │
                       ▼
                ┌─────────────┐
                │     PWA     │
                │  Reservas   │
                └──────┬──────┘
                       │
                       ▼
                 ┌───────────┐
                 │ SUPABASE  │
                 │           │
                 │ servicios │
                 │ horarios  │
                 │ bloqueos  │
                 │ citas     │
                 │ clientes  │
                 └─────┬─────┘
                       │
                  cita creada
                       │
                       ▼
                     n8n
                  ┌────┴────┐
                  ▼         ▼
               Cliente  Profesional
               WhatsApp   WhatsApp
```

---

# 3. Qué YA tenemos

La base de datos ya contiene las piezas principales:

- `empresa`
- `servicios`
- `clientes`
- `citas`
- `horario_atencion`
- `bloqueos_agenda`
- `configuracion`

También existe `conversacion_estado`, pero **no será necesaria para el flujo principal de la PWA**.

No vamos a modificar la arquitectura para hacerla multitenant todavía.

Este MVP es exclusivamente para una profesional.

---

# 4. Orden de trabajo

## FASE 1 — Revisar lo existente

### Objetivo

Entender exactamente cómo funciona actualmente el panel administrativo.

### Comprobar

- [ ] Crear servicio desde el panel.
- [ ] Editar servicio.
- [ ] Eliminar/desactivar servicio.
- [ ] Configurar horarios.
- [ ] Crear una cita manual.
- [ ] Ver una cita en el calendario.
- [ ] Crear bloqueos de agenda.
- [ ] Confirmar que todo queda correctamente guardado en Supabase.

### Resultado esperado

El panel administrativo sigue funcionando exactamente como antes.

**No modificarlo salvo que sea necesario.**

---

# FASE 2 — Crear la lógica de disponibilidad

Esta es la parte más importante del proyecto.

Necesitamos una función que responda:

> Para determinada fecha y servicio, ¿qué horarios están disponibles?

Conceptualmente:

```text
getAvailableSlots(
    fecha,
    servicio_id
)
```

Debe tener en cuenta:

```text
horario_atencion
        +
bloqueos_agenda
        +
citas existentes
        +
duracion del servicio
```

### Ejemplo

Horario:

```text
09:00 → 18:00
```

Servicio:

```text
Manicure
60 minutos
```

Citas existentes:

```text
10:00 → 11:00
14:00 → 15:00
```

Resultado:

```text
09:00
11:00
12:00
13:00
15:00
16:00
17:00
```

---

# 5. MUY IMPORTANTE — No confiar solamente en el frontend

La PWA puede mostrar:

```text
15:00
16:00
17:00
```

pero cuando el cliente pulse:

```text
CONFIRMAR
```

Supabase debe volver a comprobar que el horario sigue disponible.

Esto evita:

```text
Cliente A ve 15:00 disponible
Cliente B ve 15:00 disponible

Cliente A confirma
Cliente B confirma
```

La creación de la cita debe ser segura.

---

# FASE 3 — Crear la función de creación de cita

Crear una función de backend/RPC que conceptualmente haga:

```text
createAppointment()
```

Debe:

1. Recibir servicio.
2. Recibir fecha.
3. Recibir hora.
4. Recibir nombre.
5. Recibir WhatsApp.
6. Comprobar horario laboral.
7. Comprobar bloqueos.
8. Comprobar citas existentes.
9. Comprobar duración del servicio.
10. Crear la cita si todo está correcto.
11. Devolver el ID de la cita.

Si el horario ya fue ocupado:

```text
HORARIO_NO_DISPONIBLE
```

La PWA mostrará:

> Este horario acaba de ser ocupado. Por favor selecciona otro.

---

# FASE 4 — Construir la PWA

No hacer una aplicación compleja.

Inicialmente solamente necesitamos estas pantallas:

## Pantalla 1 — Servicio

```text
¿Qué servicio deseas?

[ Manicure ]
[ Pedicure ]
[ Semipermanente ]
[ Uñas acrílicas ]
```

Los servicios deben salir directamente de:

```text
servicios
```

No duplicar servicios en el frontend.

---

## Pantalla 2 — Fecha

```text
¿Cuándo quieres venir?

[ Calendario ]
```

No permitir seleccionar:

- días pasados;
- días sin atención;
- fechas bloqueadas completamente.

---

## Pantalla 3 — Hora

Después de seleccionar fecha:

```text
Horarios disponibles

[ 09:00 ]
[ 10:30 ]
[ 14:00 ]
[ 15:30 ]
[ 17:00 ]
```

Los horarios vienen de la función de disponibilidad.

---

## Pantalla 4 — Datos

```text
Nombre

[________________]

WhatsApp

[________________]

[ CONTINUAR ]
```

No pedir cuenta ni contraseña.

---

## Pantalla 5 — Confirmación

Mostrar:

```text
Tu cita

Servicio:
Manicure

Fecha:
Viernes 28 de agosto

Hora:
15:30

Nombre:
María

WhatsApp:
XXXXXXXXXX

[ CONFIRMAR CITA ]
```

---

# FASE 5 — Guardar la cita

Cuando el cliente confirme:

```text
PWA
 ↓
createAppointment()
 ↓
Supabase
 ↓
citas
```

La cita debe aparecer inmediatamente en el panel administrativo existente.

### Comprobar

- [ ] La cita aparece en el calendario.
- [ ] Tiene el servicio correcto.
- [ ] Tiene fecha correcta.
- [ ] Tiene hora correcta.
- [ ] Tiene nombre correcto.
- [ ] Tiene teléfono correcto.
- [ ] El estado inicial es `agendada`.

La tabla `citas` ya dispone de estos campos principales: `user_id`, `cliente_nombre`, `cliente_numero`, `servicio_id`, `fecha_inicio`, `hora_inicio` y `estado`.

---

# FASE 6 — Clientes

Cuando se confirme una reserva:

```text
cliente nuevo
       ↓
clientes
```

Si el número ya existe:

```text
cliente existente
       ↓
utilizar cliente existente
```

No crear duplicados.

La tabla `clientes` actualmente tiene `numero` como campo único, por lo que esto debe respetarse.

---

# FASE 7 — n8n

SOLAMENTE cuando la reserva ya funcione perfectamente sin n8n.

El primer workflow será deliberadamente pequeño:

```text
Nueva cita
    ↓
n8n
    ↓
Enviar WhatsApp al cliente
    ↓
Enviar WhatsApp a la profesional
```

No intentar hacer el calendario dentro de n8n.

No intentar gestionar estados conversacionales.

No intentar calcular disponibilidad dentro de n8n.

---

# FASE 8 — Mensaje al cliente

Ejemplo:

```text
💅 ¡Tu cita está confirmada!

Servicio: {{servicio}}
Fecha: {{fecha}}
Hora: {{hora}}

Te esperamos en Angel Nails. ❤️
```

---

# FASE 9 — Mensaje a la profesional

Ejemplo:

```text
📅 NUEVA CITA

Cliente: {{cliente}}
WhatsApp: {{telefono}}

Servicio: {{servicio}}
Fecha: {{fecha}}
Hora: {{hora}}
```

---

# FASE 10 — Pruebas

Antes de entregar, probar:

## Servicios

- [ ] Servicio activo aparece.
- [ ] Servicio inactivo no aparece.
- [ ] Precio correcto.
- [ ] Duración correcta.

## Fechas

- [ ] Día laboral.
- [ ] Día no laboral.
- [ ] Día bloqueado.
- [ ] Fecha pasada.

## Horarios

- [ ] Horario libre.
- [ ] Horario ocupado.
- [ ] Bloqueo parcial.
- [ ] Bloqueo completo.
- [ ] Servicio largo que no cabe antes del cierre.

## Reservas

- [ ] Crear cita.
- [ ] Intentar reservar horario ocupado.
- [ ] Intentar doble reserva.
- [ ] Cita aparece en panel.
- [ ] Cliente queda registrado.

## WhatsApp

- [ ] Cliente recibe confirmación.
- [ ] Profesional recibe notificación.

---

# 11. Lo que NO vamos a hacer todavía

Para evitar retrasos, quedan fuera del MVP:

- [ ] IA.
- [ ] Agente conversacional.
- [ ] Login del cliente.
- [ ] Aplicación nativa Android/iOS.
- [ ] Multiempresa.
- [ ] Multi-profesional.
- [ ] Pagos online.
- [ ] Sistema de fidelización.
- [ ] Promociones.
- [ ] Historial avanzado.
- [ ] Chat dentro de la PWA.
- [ ] Panel administrativo nuevo.

---

# 12. Futuro

Cuando el MVP funcione:

```text
MVP
 │
 ├── PWA
 ├── Supabase
 └── n8n
       │
       ├── confirmaciones
       ├── recordatorios
       ├── cancelaciones
       └── reprogramaciones
```

Después:

```text
IA
 │
 ├── responder preguntas
 ├── recomendar servicios
 ├── interpretar mensajes
 └── enviar al cliente a reservar
```

Y posteriormente:

```text
MULTITENANT
 │
 ├── negocios
 ├── profesionales
 ├── servicios
 ├── agendas
 └── clientes
```

---

# 13. Regla principal del proyecto

> **La PWA gestiona la experiencia de reserva.**
>
> **Supabase gestiona los datos y la disponibilidad.**
>
> **n8n gestiona las automatizaciones.**
>
> **La IA, si llega, solamente gestiona conversación.**

No mezclar responsabilidades.

---

# 14. Objetivo de mañana

Mañana NO intentar terminar todo.

El objetivo es conseguir solamente esto:

```text
PWA
  ↓
mostrar servicios reales de Supabase
  ↓
seleccionar un servicio
  ↓
seleccionar una fecha
```

Si al final del día tenemos eso funcionando, **el día fue exitoso**.

Después continuamos con:

```text
fecha
 ↓
disponibilidad
 ↓
hora
 ↓
datos
 ↓
crear cita
 ↓
WhatsApp
```

Una pieza a la vez.

---

# 15. Checklist final del MVP

- [ ] Servicios desde Supabase
- [ ] Calendario
- [ ] Disponibilidad real
- [ ] Selección de hora
- [ ] Datos del cliente
- [ ] Creación segura de cita
- [ ] Cliente guardado
- [ ] Cita visible en panel profesional
- [ ] WhatsApp cliente
- [ ] WhatsApp profesional
- [ ] Pruebas de doble reserva
- [ ] Deploy de PWA

## Definición de "terminado"

El MVP está terminado cuando una persona que nunca ha usado el sistema puede:

```text
Abrir enlace
    ↓
Elegir servicio
    ↓
Elegir fecha
    ↓
Elegir hora
    ↓
Escribir nombre + WhatsApp
    ↓
Confirmar
    ↓
Recibir WhatsApp
```

y la profesional puede abrir su panel y ver inmediatamente la nueva cita.
