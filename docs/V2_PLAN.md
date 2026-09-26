# Angel Nails V2.0 — Plan de producto y ejecución

**Estado:** base inicial V2 en desarrollo; panel y portal de muestra operativos localmente
**Actualizado:** 2026-09-26
**Decisión de producto:** diseñar para varios negocios desde el inicio y usar Angel Nails como primer negocio piloto.

## Objetivo

Construir una plataforma profesional para que varios salones puedan administrar sus negocios y para que sus clientes reserven desde móvil, sin que una cuenta pueda ver o modificar información de otra.

La V2 reemplazará la V1 solo después de alcanzar paridad de los flujos acordados, superar las verificaciones de seguridad y completar una migración de datos ensayada. La V1 se conserva como referencia durante ese proceso.

## Alcance inicial

### Panel del negocio

- Inicio de sesión, recuperación de acceso y aislamiento por negocio.
- Resumen operativo del día y próximas citas.
- Calendario con vistas de agenda, día y semana.
- Crear, consultar, mover, cancelar y actualizar estados de citas.
- Catálogo de servicios, duración, precio y estado.
- Clientes con historial y datos de contacto.
- Horarios semanales, excepciones por fecha y bloqueos parciales o completos.
- Configuración del negocio, políticas, zona horaria y conexión de WhatsApp.

### Portal del cliente

- Catálogo de servicios con precio y duración.
- Disponibilidad calculada en servidor y reserva confirmada de forma atómica.
- Consulta, cancelación y reagendamiento autorizados mediante una credencial de cliente verificada.
- Confirmaciones y recordatorios por WhatsApp como parte de la integración, con estados de entrega visibles para el negocio.
- Diseño móvil prioritario, accesible y con estados completos de carga, error, vacío y éxito.

### Fuera de la primera entrega

- Pagos y depósitos en línea.
- Aplicaciones nativas.
- Agendamiento mediante IA libre.
- Nómina, inventario y contabilidad.
- Marketplace público de salones.

## Arquitectura objetivo

- **Web:** React + TypeScript + Vite/PWA, con rutas diferenciadas para panel y portal público.
- **API:** servicio Node.js/TypeScript separado; la base actual usa Hono para validar identidad y membresía antes de exponer datos del negocio.
- **Datos:** Supabase/PostgreSQL; Auth para personal del negocio; políticas RLS como segunda barrera de aislamiento.
- **Tenancy:** cada dato operativo pertenece a un `business_id`; las relaciones y consultas siempre se validan contra el negocio autenticado.
- **Reservas:** procedimientos transaccionales en PostgreSQL para revalidar disponibilidad y prevenir solapamientos bajo concurrencia.
- **Cliente final:** no se confía en UUIDs enviados por URL. Se usa una prueba de control de teléfono y credenciales de reserva limitadas, con caducidad, revocación y alcance definido.
- **WhatsApp:** adaptador server-side hacia Evolution API; secretos solo en servidor; webhooks autenticados, deduplicación, reintentos y registro de resultados.
- **Operación:** entornos local, staging y producción separados; migraciones versionadas; logs sin secretos ni datos personales innecesarios.

La V2 no requiere cambiar de framework por moda. Se conservarán React y TypeScript. El scaffold vivirá en `v2/`, separado de las rutas, dependencias y build de V1.

## Decisiones de arranque

Decisiones provisionales para poder avanzar; se revisan antes de desplegar producción:

- **Cliente:** verificación de teléfono con código de un solo uso enviado al WhatsApp del negocio; limitar intentos, frecuencia y vigencia. No autorizar operaciones con `customer_id` o `appointment_id` por sí solos.
- **Personal:** Supabase Auth para iniciar sesión y tablas de membresía por negocio con roles iniciales `owner`, `admin` y `staff`.
- **API:** Node.js/TypeScript en servicio independiente. Validar el JWT y la membresía en cada operación; la clave `service_role` permanece solo en el servidor. Aplicar RLS como segunda barrera.
- **Web/API:** web React + TypeScript + Vite en Netlify; API y Evolution en servicios Docker. Definir dominios/CORS de staging y producción antes del despliegue.
- **Datos:** Supabase/PostgreSQL existente solo se inspecciona para diseñar una importación; V2 empieza con su propio esquema/migraciones y staging.
- **Tenant:** un negocio puede tener varios miembros; clientes, citas, servicios, horarios e integraciones siempre están vinculados a `business_id`.
- **Integración WA:** conservar Evolution como adaptador inicial, pero cada negocio tiene credenciales/instancia aisladas; no compartir una instancia global como modelo SaaS.

Modelo inicial a validar: `platform_admins`, `businesses`, `profiles`, `business_memberships`, `plans`, `subscriptions`, `implementation_orders`, `billing_events`, `billing_audit_log`, `customers`, `services`, `business_hours`, `schedule_exceptions`, `appointments`, `otp_challenges`, `whatsapp_integrations` y `message_outbox`.

## Modelo SaaS y facturación

### Tres superficies del producto

1. **Superadmin de plataforma (propietario del SaaS):** crea/activa/suspende negocios, asigna plan, define prueba, registra implementación, controla pagos, amplía una prueba con motivo y consulta auditoría. No opera como administrador normal del negocio; sus acciones privilegiadas deben registrarse.
2. **Administrador del negocio:** owner/admin/staff con permisos limitados a sus membresías; configura servicios, personal, horarios, WhatsApp y facturación de su negocio.
3. **Cliente final:** reserva como invitado tras verificar su WhatsApp con OTP; consulta/cancela/reagenda solo sus citas. No necesita acceso al panel ni obtiene acceso mediante conocer un UUID.

El cliente puede ser atendido por un salón de uñas, estética, spa o barbería. La estructura de servicios, copy y marca será neutral; cada negocio configura colores, logo, tipo de servicio y vocabulario. No diseñar el dominio suponiendo que todos los clientes o profesionales sean mujeres.

### Planes y precios — propuesta para probar, no tarifa final

**Referencias consultadas el 2026-09-26:**

- [Fresha — precios en COP](https://www.fresha.com/pricing): COP $24.300/mes para Independiente y COP $16.200 por miembro de equipo reservable/mes para Equipo; muestra prueba de 7 días. Es referencia directa del segmento, no igualdad de prestaciones.
- [AgendaPro Colombia](https://www.agendapro.com/co/): promociona agenda, CRM, WhatsApp/IA, marketing, pagos y onboarding; la página pública consultada ofrece prueba/registro, pero no publica una tarifa colombiana comparable.
- [Square Appointments](https://squareup.com/us/en/appointments/pricing): referencia de empaquetado con planes por sede (Free, USD $49 y USD $149 al mes en la página consultada), pero es precio de EE. UU.; **no** convertir directamente a COP como comparativa local.
- No se encontró tarifa pública comparable de implementación/onboarding. Las tarifas únicas siguientes son hipótesis de Alma, no precios atribuidos a competidores.

**Hipótesis inicial en COP, antes de confirmar IVA, costos de mensajería y proveedor de pagos:**

| Plan | Suscripción sugerida | Implementación única sugerida | Alcance inicial |
|---|---:|---:|---|
| Esencial | $39.900/mes | $149.000 | 1 sede, owner + hasta 2 profesionales, agenda, servicios, portal y métricas básicas. |
| Profesional | $79.900/mes | $299.000 | 1 sede, owner/admin + hasta 6 profesionales, roles, reportes y automatización WhatsApp con consumos medidos. |
| Multi-sede | Desde $159.900/mes | Desde $599.000 | Hasta 3 sedes y 15 profesionales, control central, configuración y onboarding asistido; volumen superior cotizado. |

La prueba sugerida dura **7 días** para la suscripción y comienza después de que el negocio esté configurado y listo para usar. La tarifa única cubre parametrización, marca y onboarding acordado; debe mostrarse separada y aceptarse antes de cobrarla. El checkout debe aclarar si hay tarjeta requerida, cuándo se cobra la mensualidad, renovación, impuestos, cancelación y límites de mensajería. No prometer WhatsApp ilimitado: presupuestar créditos o consumo aparte.

Validar la propuesta con 10–15 salones de belleza, spas y barberías de tamaños distintos y con Angel Nails: medir disposición a pagar, valor de implementación, profesionales por negocio, costos de soporte, mensajería y abandono tras prueba. Ajustar precios antes de publicar como tarifa definitiva; la página debe etiquetarlos como COP y especificar IVA según revisión contable local.

### Ciclo de vida de negocio y cobro

- Separar `business_status` (onboarding/active/suspended/closed) de `subscription_status` (trialing/active/past_due/suspended/cancelled); el pago nunca borra ni cambia la propiedad de los datos.
- Al terminar los 7 días, se requiere una suscripción pagada para seguir aceptando reservas. El servicio pasa a bloqueado en cuanto el proveedor confirma vencimiento impago; reconciliación diaria repara webhooks perdidos y los webhooks actualizan el estado inmediatamente.
- Antes del vencimiento: avisos configurables (por ejemplo 3 días y 1 día antes); al fallar el cargo: aviso con instrucciones de pago. Aplicar la regla solicitada sin periodo de gracia oculto: al vencimiento impago se deshabilitan panel operativo, portal de reserva, API y automatizaciones de ese tenant.
- El superadmin conserva acceso de soporte con auditoría; el owner puede entrar a una vista limitada de facturación y exportar sus datos durante suspensión. No eliminar citas, clientes ni configuración por mora.
- Reactivar solo después de una confirmación autoritativa del proveedor de pagos; nunca aceptar desde frontend un `paid=true` o cambio de plan.
- Registrar `trial_started_at`, `trial_ends_at`, periodo pagado, vencimiento, estado, último evento procesado y `provider_event_id` idempotente. La reconciliación diaria debe ser reentrante e idempotente.
- Evaluar proveedor de pagos con soporte de suscripción/cobro recurrente en Colombia (COP, medios locales, webhooks, reembolsos, comprobantes, conciliación y comisiones) antes de elegir integración. No se eligió proveedor todavía.

### Landing pública y conversión

- Landing propia de V2: explicar resultados del producto, mostrar los tres planes y la implementación separada, permitir comparar funciones, responder preguntas de prueba/cobro y comenzar registro.
- Incluir CTA de prueba de 7 días con consentimiento explícito de términos y recordatorio de vencimiento; no activar cobro recurrente sin autorización verificable.
- El flujo crea negocio + owner, aplica onboarding/configuración, elige plan y programa la prueba. No habilita operación normal de un tenant en mora.
- No publicar métricas ficticias, ahorros garantizados, clientes que no existen o logotipos sin permiso. Mostrar datos del piloto solo con aprobación del negocio.

El modelo de datos debe incluir, como mínimo, `plans`, `subscriptions`, `billing_events` idempotentes y un registro de auditoría del superadmin, además de las entidades operativas multi-tenant. Las reglas de acceso a superadmin serán independientes de `business_memberships`.

## Fases y criterios de salida

### Fase 0 — Decisiones y mapa de V1

- [x] Elegir V2 multi-negocio con Angel Nails como piloto.
- [x] Inventario inicial de pantallas y servicios del panel/portal.
- [x] Revisar el SQL base, límites de RLS y modelo de identidad actual.
- [x] Registrar decisiones provisionales de verificación, membresías y despliegue.
- [ ] Completar matriz elemento por elemento y registrar reglas no explícitas.
- [ ] Validar dominio y despliegue de staging con el propietario antes de producción.

**Salida:** decisiones registradas y mapa de migración aprobado; no se borra código de V1.

### Fase 1 — Base segura de V2

- [x] Crear la aplicación V2 aislada de la V1 en `v2/` como workspace independiente.
- [x] Crear el esquema inicial multi-negocio y su primera migración.
- [x] Definir roles iniciales, membresías, políticas RLS, índices y límites compuestos por negocio.
- [x] Crear API base Hono/Node con health, validación de JWT y membresía activa por negocio.
- [x] Añadir pruebas de acceso A/B, token ausente/incorrecto, UUID incorrecto y CORS.
- [ ] Añadir creación segura del primer negocio/membresía, auditoría y autorización por acción/rol.
- [ ] Aplicar migración en staging Supabase y verificar RLS con usuarios reales de dos negocios.

**Salida:** un usuario del negocio A no puede leer ni alterar datos del negocio B, incluso llamando directamente a la API.

### Fase 2 — Reserva del cliente

- [x] Implementar prototipo visual navegable de catálogo y flujo móvil servicio, fecha, hora, datos, confirmación y gestión local de citas.
- [ ] Conectar catálogo y flujo de reserva al API; dejar de usar horarios y resultados de muestra.
- [ ] Añadir verificación de teléfono/control del enlace y renovación/revocación de credenciales.
- [ ] Implementar disponibilidad, reserva atómica, cancelación y reagendamiento.
- [ ] Probar colisiones concurrentes, bloqueos, horarios límite, estados y expiración de credenciales.

**Salida:** pruebas automatizadas confirman que no hay doble reserva ni acceso a citas ajenas.

### Fase 3 — Panel administrativo

- [x] Diseñar la primera dirección visual responsive, con tema claro/oscuro persistido y navegación accesible.
- [x] Crear shell del panel con resumen, agenda por fecha, filtros y alta local de cita de demostración.
- [ ] Implementar calendario, lista de citas, estados y acciones.
- [ ] Implementar servicios, clientes, horarios, excepciones y bloqueos.
- [ ] Añadir configuración, permisos, estados vacíos y errores recuperables.

**Salida:** flujos críticos de agenda funcionan en escritorio y móvil, con cobertura de pruebas acordada.

### Fase 4 — Superadmin, landing y facturación

- [ ] Crear acceso de plataforma separado y protegido para `platform_superadmin`.
- [ ] Crear/listar/editar/suspender negocios e invitar al owner con plan y prueba configurados.
- [ ] Implementar landing pública con comparación de los 3 planes, tarifa única, condiciones del trial y alta con consentimiento.
- [ ] Integrar pagos recurrentes y cobro único de implementación con eventos idempotentes del proveedor.
- [ ] Implementar estados `trialing`, `active`, `past_due`, `suspended` y `cancelled`, avisos y reconciliación diaria.
- [ ] Bloquear panel operativo, portal de reserva, API y automatizaciones tras vencimiento impago; permitir facturación/exportación al owner y acceso auditado al superadmin.
- [ ] Reactivar automáticamente solo tras confirmación server-side del pago.

**Salida:** superadmin controla tenants; negocio trialing opera 7 días; negocio vencido queda bloqueado sin borrar datos; pago confirmado restaura operación.

### Fase 5 — WhatsApp y automatización

- [ ] Conectar una instancia de Evolution por negocio de forma segura.
- [ ] Autenticar webhooks y hacerlos idempotentes.
- [ ] Enviar confirmaciones, cancelaciones y recordatorios con reintentos.
- [ ] Gestionar traspaso a humano y mostrar salud/últimos errores en el panel.

**Salida:** mensajes duplicados o webhook repetido no crean acciones duplicadas; fallos se pueden observar y reintentar.

### Fase 6 — Migración, despliegue y retiro de V1

- [ ] Ensayar importación de Angel Nails en un staging aislado.
- [ ] Comparar citas, servicios, horarios y clientes antes/después.
- [ ] Preparar respaldo, ventana de cambio y procedimiento de reversión.
- [ ] Activar V2 para el piloto y observar operación real.
- [ ] Retirar archivos de V1 únicamente tras verificar reemplazo, referencias y recuperación.

**Salida:** V2 es el sistema activo, los datos fueron reconciliados y existe un respaldo restaurable.

## Política de limpieza del repositorio

No se eliminará algo solo porque parezca antiguo. Antes de retirar un archivo:

1. Confirmar que no haya imports, rutas, scripts, despliegues, documentación ni usuarios que dependan de él.
2. Confirmar que la V2 cubra el mismo comportamiento y pase sus pruebas.
3. Revisar los cambios locales y generados; nunca descartar trabajo sin identificar su origen.
4. Eliminar en una unidad pequeña y validar build/tests inmediatamente.
5. Mantener los datos y los secretos fuera de la limpieza de código; nunca copiar `.env` a la V2 ni a Git.

Mientras exista tráfico o información útil, la V1 permanece disponible como referencia y plan de reversión. El código V1 no se copiará mecánicamente a la V2: se reutilizan solo reglas comprendidas y verificadas.

## Inventario inicial de V1

Este es un primer mapa basado en rutas/imports visibles; no es autorización para borrar archivos.

| Área | Elementos actuales | Tratamiento V2 |
|---|---|---|
| Panel | `Dashboard`, `Calendario`, `GestionCitas`, `Servicios`, `Empresa`, `Configuracion`, `Login` | Reemplazar con módulos y permisos multi-negocio; usar la V1 para descubrir reglas que faltan documentar. |
| Portal | `BookingPage` y pasos de servicio, fecha, hora, datos, resumen, consulta, cancelación y reagendamiento | Rediseñar como experiencia móvil accesible y conservar solo reglas de negocio verificadas. |
| Servicios frontend | `citasService`, `misCitas`, `disponibilidadService`, `serviciosService`, `empresaService`, `evolutionService`, `bookingApi` | Reemplazar por clientes API tipados; no copiar llamadas directas a Supabase con privilegios de cliente. |
| WhatsApp | `whatsapp-autoresponder/index.js`, `config.json`, Docker y Evolution API | Reutilizar conceptos; separar integración, webhooks y trabajos con idempotencia, autenticación y observabilidad. |
| Base de datos | `database.sql` más migraciones V1 recientes | Diseñar un esquema V2 limpio multi-tenant; documentar importación, no reutilizar ciegamente el SQL V1. |
| Duplicado posible | `src/pages/Configuracion copy.tsx` | No aparece importado por las rutas actuales según búsqueda inicial; candidato a retirar después de comparar diferencias y revisar referencias externas. |
| Módulo desactivado | `src/pages/ListaBlanca.tsx` y su ruta comentada en `src/App.tsx` | Confirmar si tiene valor operativo o si fue abandonado antes de decidir retiro. |
| Artefactos | `dist/`, `dev-dist/`, `node_modules/` | Salidas/dependencias locales; confirmar `.gitignore` y scripts antes de cualquier limpieza. Preservar cambios locales detectados en `dev-dist/sw.js`. |
| Pruebas | No se encontraron archivos `*.test.*` o `*.spec.*` en la primera búsqueda | Añadir pruebas de dominio, API, aislamiento entre negocios y flujos críticos desde la base de V2. |

Hallazgos del primer inventario:

- `src/App.tsx` monta el panel existente y el portal `/reservar`; el panel se reutiliza como referencia funcional, no como base visual obligatoria.
- `empresa`, `servicios`, `horario_atencion`, `bloqueos_agenda`, `citas` y `configuracion` dependen de `user_id` en lugar de una entidad negocio y membresías.
- `clientes.numero` es globalmente único y `conversacion_estado` no contiene un negocio; esos dos modelos no se pueden reutilizar tal cual en SaaS.
- La agenda V1 genera horarios concretos por fecha; V2 debe separar horario semanal recurrente de excepciones/bloqueos por fecha y definir zona horaria del negocio.
- El panel actual usa Supabase Auth, pero no se encontró modelo de roles de personal.
- V1 despliega el frontend con fallback SPA de Netlify y usa Docker Compose para Evolution/API. Compose incluye valores de ejemplo inseguros; no copiarlos a V2.

## Estado de implementación V2

- Workspace pnpm incluye paquetes independientes `v2` (web) y `v2/api` (API); V1 conserva sus propios scripts y dependencias.
- Web: panel con navegación, agenda por fecha, filtros, clientes, servicios, horarios, WhatsApp de muestra y formulario local para alta de citas.
- Portal: ruta `/reservar/angel-nails` con catálogo, reserva por pasos y consulta/reagendamiento/cancelación en estado local. Tiene tema claro/oscuro compartido con el panel y preferencias persistidas en el navegador.
- **Persistencia:** panel y portal son prototipos; no guardan datos en Supabase/API. No presentar como agenda productiva.
- Superadmin, landing de venta, checkout, planes en base de datos, OTP real, trial/billing y bloqueo por mora aún no están implementados; están especificados en este plan.
- API: `GET /health` y `GET /v1/businesses/:businessId/session`; requiere Supabase Auth + membresía activa.
- Esquema: `v2/api/migrations/0001_business_core.sql`; crea negocios, miembros, clientes, servicios, horarios, excepciones, citas, OTP, WhatsApp y outbox con RLS.
- La migración se aplicó a PostgreSQL 15 desechable. Se probó que dos negocios pueden ocupar la misma hora, un solapamiento dentro de un negocio se rechaza, `anon` no puede leer citas y RLS muestra solo el cliente del negocio autenticado.
- API tests: cinco pruebas pasan (pertenencia, aislamiento, token, UUID y CORS). Web build/lint y API build/lint pasan.
- El web dev server se deja en `http://127.0.0.1:5173/`; la API no se ha arrancado contra Supabase porque no hay `.env` V2 real.
- La marca “alma” es provisional; nombre e identidad se confirman antes de preparar producción.

## Punto de retoma

### Estado verificado

- El repositorio actual es la V1 y tiene trabajo local sin commit. `dev-dist/sw.js` ya estaba modificado antes de esta planificación y debe preservarse.
- La V1 contiene cambios de seguridad/reservas en el árbol de trabajo, pero no está desplegada como flujo seguro completo.
- Las migraciones de V1 en `supabase/migrations/` se probaron en PostgreSQL temporal, no en la base real.
- El `.env` del microservicio aún no tiene `SUPABASE_SERVICE_ROLE_KEY` ni `BOOKING_LINK_SECRET`; no aplicar el cierre de RLS de V1 hasta configurar/desplegar el backend correspondiente.
- El scaffold y código inicial V2 existen solo en `v2/`; no hay tablas V2 ni servicios conectados en Supabase real.
- V1 sigue intacta como superficie de referencia; sus cambios locales no están limpios y deben preservarse.
- `v2/api/.env.example` es plantilla; no se han creado ni copiado secretos reales de V1.
- No eliminar ni renombrar archivos de V1 durante la creación del scaffold.

### Próxima sesión

1. Leer este documento y comprobar `git status` antes de editar.
2. Crear un proyecto Supabase nuevo para desarrollo de V2, separado de V1 y producción; no copiar datos ni secretos de V1.
3. Revisar branding “Alma” y confirmar el nombre de producto antes de la landing pública.
4. Diseñar migración `0002_saas_billing.sql`: superadmin inicial, planes, implementación, suscripción, eventos y auditoría.
5. Añadir bootstrap seguro del primer superadmin/negocio y onboarding idempotente con owner, plan y trial de 7 días.
6. Probar estados de facturación/suspensión y roles con proveedores simulados antes de integrar un proveedor real.
7. Implementar OTP de cliente y las reservas transaccionales en staging.
8. No migrar datos, apagar servicios ni aplicar migraciones de V1 como parte del trabajo V2.

## Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-26 | V2 multi-negocio; Angel Nails es el piloto | Permite ofrecer el producto a otros salones sin rehacer el aislamiento después. |
| 2026-09-26 | Mantener V1 hasta paridad y validación de V2 | Reduce riesgo de pérdida de datos y conserva una ruta de reversión. |
| 2026-09-26 | Mantener React + TypeScript y no copiar V1 mecánicamente | Reutilizar habilidades y reglas verificadas sin heredar deuda accidental. |
