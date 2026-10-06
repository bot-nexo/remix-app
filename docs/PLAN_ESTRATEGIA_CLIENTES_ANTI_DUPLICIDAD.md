# Plan de Implementación Definitivo: Estrategia Anti-Duplicidad de Clientes (LID vs. Número)

**Proyecto:** Angel Nails — Sistema de Reservas & Bot Autoresponder  
**Fecha:** 6 de Octubre de 2026  
**Estado:** Aprobado para implementación tras auditoría de base de datos  

---

## 1. Diagnóstico del Problema y Causa Raíz

En el ecosistema conviven 4 puntos de entrada a la tabla `clientes`:
1. **WhatsApp Autoresponder (`whatsapp-autoresponder`):**
   - Mensajes recibidos con Meta LID (`@lid`, ej. `268225153638543`).
   - El bot guarda temporalmente `lid` y `nombre` (pushName), con `numero: NULL`.
2. **Catálogo Web de Reservas (`/reservar`):**
   - El cliente entra mediante enlace firmado con su `id` o mediante acceso directo.
   - En el formulario de reserva ingresa su teléfono real (ej. `3104986552` -> `573104986552`) y nombre.
3. **Agendamiento Manual por Profesional (`GestionCitas.tsx`):**
   - La profesional registra una cita ingresando el teléfono y nombre del cliente.
4. **Administración de Clientes (`Clientes.tsx`):**
   - Registro y edición directa de clientes desde el panel administrativo.

### Efecto no deseado actual:
- Si un cliente inicia por WhatsApp (LID) y luego se registra por el catálogo o por la profesional por número telefónico, se generan dos registros separados para la misma persona en la tabla `clientes`.
- Ocasionalmente números telefónicos (10-12 dígitos) se almacenaron de forma errónea en la columna `lid`.

---

## 2. Estrategia de Solución Integral (100% Anti-Duplicidad)

### A. Estandarización de Identificadores
- **Teléfono Real (`numero`):** E.164 sin signo más (12 dígitos para Colombia: `573XXXXXXXXX`).
- **Meta LID (`lid`):** Identificador privado de Meta (≥ 14 dígitos numéricos, ej. `268225153638543`).
- **Regla:** Ningún número ≤ 12 dígitos puede guardarse en la columna `lid`.

### B. Función Atómica de Fusión en Base de Datos (PostgreSQL RPC)
Creación de la función `reconciliar_o_crear_cliente`:
- **Búsqueda multinivel:** 
  1. Por `id` (si se proporciona desde el token/URL).
  2. Por `numero` (coincidencia canónica o últimos 10 dígitos).
  3. Por `lid` (coincidencia exacta).
- **Auto-Merge (Fusión y Consolidación):**
  - Si el cliente ya existía en dos filas distintas (una con LID y otra con Número), las fusiona en un único registro maestro con ambos campos poblados.
  - Re-apunta citas (`citas`), estados de conversación (`conversacion_estado`) y lista blanca (`lista_blanca`).
  - Elimina la fila huérfana duplicada.

### C. Sincronización en las 4 Puertas de Entrada
1. **Autoresponder (`whatsapp-autoresponder/index.js`):** Clasificación estricta de LID vs Número y llamada unificada al motor de reconciliación.
2. **Catálogo Web (`AccesoSeguroWhatsApp.tsx` & `BookingPage.tsx`):** Fusión automática al completar el agendamiento.
3. **Gestión de Citas (`GestionCitas.tsx`):** Agendamiento manual conectado a la reconciliación.
4. **Gestión de Clientes (`Clientes.tsx`):** CRUD conectado a la reconciliación y sincronización de Lista Blanca.

### D. Control del Bot & Lista Blanca
- **Intervención Humana:** Detección de mensajes de la profesional (`fromMe: true`) silenciando el bot (`HUMANO`) buscando por LID o Número.
- **Comandos:** Soporte preciso para `cerrar.` (reactivar bot a `MENU_PRINCIPAL`) y `pausar.` (silenciar bot a `HUMANO`).
- **Lista Blanca:** Validación cruzada tanto por número telefónico como por LID vinculado.

---

## 3. Matriz de Archivos a Modificar / Crear

| Archivo | Acción | Descripción |
| :--- | :---: | :--- |
| `supabase/migrations/20261006_definitive_client_reconciliation.sql` | Crear | Limpieza de duplicados existentes y creación de RPC `reconciliar_o_crear_cliente`. |
| `whatsapp-autoresponder/index.js` | Modificar | Clasificación de identificadores, reconciliación y control de chat. |
| `src/services/clientesService.ts` | Modificar | Servicio frontend unificado de clientes y normalización. |
| `src/pages/GestionCitas.tsx` | Modificar | Agendamiento manual usando reconciliación atómica. |
| `src/pages/Clientes.tsx` | Modificar | Panel de clientes y Lista Blanca con soporte LID + Teléfono. |

---

## 4. Próximos Pasos Inmediatos
1. Extraer y auditar el estado real de la base de datos Supabase (Tablas, Columnas, Triggers, Funciones, Políticas RLS).
2. Limpiar scripts SQL obsoletos o redundantes en el repositorio.
3. Ejecutar la migración SQL definitiva y aplicar los cambios de código.
