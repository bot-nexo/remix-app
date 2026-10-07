# 🧪 Plan de Pruebas QA — Sistema de Reservas & Bot Autoresponder

**Responsable de Pruebas:** Tester Senior (Tú)  
**Objetivo:** Validar el 100% de los flujos de agendamiento, bot de WhatsApp, atención humana y anti-duplicidad de clientes (LID vs. Número).  
**Fecha:** 6 de Octubre de 2026  

---

## 📋 Matriz de Escenarios de Prueba

```mermaid
flowchart TD
    A[Inicio de Prueba] --> B[Caso 1: WhatsApp Bot Nuevo Cliente]*
    B --> C[Caso 2: Agendamiento por Catálogo Web con Enlace]*
    C --> D[Caso 3: Ingreso Directo a la PWA sin Enlace]*
    D --> E[Caso 4: Agendamiento Manual por Profesional]*
    E --> F[Caso 5: Control del Bot - Intervención y Comandos]x
    F --> G[Caso 6: Lista Blanca con LID y Teléfono]x
    G --> H[Verificación Final en Supabase: CERO Duplicados]*
```

---

## 🧪 CASO 1: Primer Contacto por WhatsApp (Cliente Nuevo vía LID)

### Objetivo:
Verificar que cuando una clienta escribe por primera vez por WhatsApp, el bot responda de inmediato y guarde un único registro inicial.

### Pasos:
1. Desde un WhatsApp que no esté registrado en la BD, escribe un mensaje de saludo al número del negocio: `"Hola, quiero información"`.
2. Espera la respuesta del bot.

### ✅ Resultado Esperado:
- [❌ ] El bot simula presencia de escritura (2 a 4 segundos).
- [✅ ] El bot responde con el mensaje de bienvenida y el enlace firmado personalizado: `https://angelnails.tech/reservar?id=...&token=...`.
- [✅ ] En Supabase (`public.clientes`): Se crea 1 registro con `nombre` (pushName de WhatsApp), `lid` (14-15 dígitos) y `numero: NULL`.

---

## 🧪 CASO 2: Agendamiento desde el Catálogo Web (Auto-Merge de Teléfono con LID)

### Objetivo:
Verificar que cuando la clienta ingresa al enlace que le envió el bot y coloca su teléfono, el sistema **no cree otro cliente**, sino que **fusione** el teléfono en la misma fila del LID.

### Pasos:
1. Haz clic en el enlace de reserva que te envió el bot en el Caso 1.
2. Selecciona un Servicio, una Fecha y una Hora disponible.
3. En el paso de Datos de la Clienta, ingresa:
   - **Nombre:** Tu nombre completo (ej: `Carolina Pérez`).
   - **WhatsApp:** Tu número a 10 dígitos (ej: `3001234567`).
4. Confirma la reserva.

### ✅ Resultado Esperado:
- [✅ ] La cita se agenda exitosamente y aparece la pantalla de confirmación.
- [ ✅] El bot de WhatsApp te envía el mensaje estructurado de **Cita Confirmada**.
- [✅ ] **Verificación en Supabase (`public.clientes`):** 
  - La fila del cliente ahora tiene **AMBOS CAMPOS**: `numero: 573001234567` y `lid: <EL_LID_INICIAL>`.
  - **Cero registros duplicados.**

---

## 🧪 CASO 3: Acceso Directo al Catálogo (Sin Enlace de WhatsApp)

### Objetivo:
Validar que si una clienta entra directamente a `https://angelnails.tech/reservar` sin parámetros en la URL, pueda identificarse y agendar sin duplicarse.

### Pasos:
1. Abre una ventana en modo incógnito y entra directo a `https://angelnails.tech/reservar`.
2. Verás la pantalla de **Acceso Seguro a la Agenda**.
3. Ingresa el mismo número del Caso 2 (`3001234567`) y tu nombre.
4. Presiona **"Ingresar a la Agenda"**.

### ✅ Resultado Esperado:
- [✅ ] Te da acceso inmediato sin errores ni recargas forzadas.
- [✅ ] Muestra tus citas o te permite agendar una nueva.
- [ ✅] En Supabase no se crea ninguna fila duplicada.

---

## 🧪 CASO 4: Agendamiento Manual por la Profesional (Panel Admin)

### Objetivo:
Verificar que cuando la profesional agenda manualmente a una clienta existente o nueva desde `GestionCitas.tsx`, no se dupliquen registros.

### Pasos:
1. Inicia sesión en el Panel Administrativo y entra a **Gestión de Citas**.
2. Haz clic en el botón superior **"+ Agendar Cita"**.
3. Ingresa los datos:
   - **Nombre:** Nombre de la clienta.
   - **Teléfono:** `3001234567` (el mismo del Caso 2).
   - **Servicio, Fecha y Hora.**
4. Haz clic en **Guardar Cita**.

### ✅ Resultado Esperado:
- [✅ ] La cita se guarda y aparece en el calendario/lista del día.
- [✅ ] La clienta recibe su notificación de WhatsApp.
- [✅ ] La cita queda asociada al `cliente_id` existente en Supabase.
- [✅ ] La tabla `clientes` sigue teniendo 1 sola fila para este teléfono.

---

## 🧪 CASO 5: Intervención Humana y Comandos (`cerrar.` y `pausar.`)

### Objetivo:
Validar que el bot se calle cuando la profesional habla y se reactive cuando se use el comando `cerrar.`.

### Pasos:
1. **Paso A (Intervención):** ❌
   - La clienta escribe por WhatsApp: `"¿Tienen servicio a domicilio?"`.
   - La profesional responde desde su propio WhatsApp en el mismo chat: `"Hola linda, no hacemos domicilios"`.
   - La clienta vuelve a escribir: `"Ah entiendo, gracias"`.
   - 👉 **Verificar:** El bot **NO debe responder** (debe permanecer en silencio porque la profesional intervino).
2. **Paso B (Reactivación con `cerrar.`):** ❌
   - La profesional escribe en el chat: `cerrar.`
   - 👉 **Verificar:** El estado de la conversación cambia a `MENU_PRINCIPAL`.
   - La clienta escribe: `"Hola"`.
   - 👉 **Verificar:** El bot **vuelve a responderle** con el menú.
3. **Paso C (Pausa manual con `pausar.`):** ❌
   - La profesional o la clienta escribe: `pausar.`
   - 👉 **Verificar:** El bot queda pausado para ese chat.

---

## 🧪 CASO 6: Lista Blanca (Contactos Excluidos / Familiares)

### Objetivo:
Verificar que los contactos en la Lista Blanca nunca reciban respuestas del bot, aunque escriban desde un chat con LID.

### Pasos:
1. En el panel de **Clientes** o **Lista Blanca**, agrega un número a la lista blanca (ej: un familiar o tu número de prueba).
2. Escribe desde ese WhatsApp al bot: `"Hola"`.

### ✅ Resultado Esperado:
- [❌ ] En la consola del autoresponder aparece: `[BOT] El remitente pertenece a la Lista Blanca. Bot ignorando mensaje.`
- [❌ ] El bot **NO envía ninguna respuesta**.
- [❌ ] Al remover el número de la Lista Blanca en el panel, el bot vuelve a atenderlo.

---

## 🏆 Criterio de Aceptación Final (Checklist de Éxito)

- [✅ ] Todas las clientas tienen su número con prefijo `57` (12 dígitos).
- [✅ ] Ninguna fila de `clientes` tiene un teléfono en la columna `lid`.
- [ ✅] Ningún cliente aparece repetido en `public.clientes`.
- [✅ ] Las citas manuales y del catálogo llegan con confirmación por WhatsApp.
- [❌] Los comandos `cerrar.` y `pausar.` responden con precisión.
