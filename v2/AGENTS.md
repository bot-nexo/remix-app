# Reglas de trabajo — Alma V2

Estas instrucciones aplican a todo lo que esté bajo `v2/`. La fuente de verdad para alcance, decisiones, fases y punto de retoma es [`../docs/V2_PLAN.md`](../docs/V2_PLAN.md).

## Antes de cada tarea

- Leer el plan V2 y comprobar `git status` antes de editar.
- Identificar qué paquete se modifica (`v2/` web o `v2/api/` API) y validar con su propio script.
- Preservar todo cambio local de V1. No mover, borrar ni renombrar archivos V1 durante construcción de V2.
- Si una decisión de producto, precio, acceso o facturación cambia, actualizar el plan en la misma tarea.

## Arquitectura y tenancy

- V2 tiene tres superficies: **superadmin de plataforma**, **administrador del negocio** y **cliente final**.
- Angel Nails es un tenant piloto; no es el tenant implícito de la arquitectura ni se pueden compartir sus datos como fixtures de producción.
- Todo dato operativo pertenece a `business_id`. Toda consulta y mutación de negocio debe comprobar JWT, membresía `active` y rol en el servidor; nunca confiar en el `business_id`, `user_id`, `customer_id` o `appointment_id` del cliente web como autorización.
- `service_role` solo puede existir en el servidor. RLS en PostgreSQL es una segunda barrera, no reemplaza la comprobación de negocio del API.
- Superadmin es una identidad/permisión de plataforma independiente de las membresías de negocio. Toda acción de soporte, suspensión, cambio de plan o extensión de prueba se audita con actor, motivo y fecha.
- Clientes verifican control de teléfono mediante OTP de un solo uso: hash en reposo, expiración corta, límites de intentos y envío, invalidación tras uso y protección contra enumeración. No emitir códigos ni credenciales permanentes en logs.
- No crear ni aplicar migraciones a producción sin probarlas primero en una base temporal y luego en staging. Nunca apuntar pruebas a credenciales o datos de V1.

## Reservas y datos

- Disponibilidad se decide en el servidor. Crear/reagendar es transaccional e idempotente; una restricción de base de datos debe impedir solapamientos por negocio.
- Cancelación, reprogramación y transiciones de estado tienen reglas explícitas y validación server-side.
- Guardar importes en unidades menores enteras y zona horaria IANA por negocio; convertir a moneda de presentación solo en UI.
- No presentar datos mock como reales. Fixtures, vistas locales y funciones que no persisten deben etiquetarse claramente como demostración.
- Conservar datos al suspender un negocio. La suspensión detiene las operaciones de uso normal; no borra citas/clientes ni elimina la capacidad del superadmin para soporte/exportación controlada.

## SaaS, trial y pagos

- El trial dura siete días según el plan aprobado. La activación de plan y cualquier cobro recurrente requieren consentimiento verificable del owner.
- Distinguir estado del negocio, estado de suscripción y estado de implementación/pago único; no derivar uno del otro en el frontend.
- Solo webhooks verificados del proveedor y reconciliación server-side pueden marcar un pago como confirmado, actualizar deuda o reactivar una cuenta.
- Al terminar el trial o confirmar mora después del vencimiento, bloquear portal de reservas, operaciones del negocio y automatizaciones de ese tenant. Mostrar estado y ruta de pago; conservar datos y acceso limitado a facturación/exportación.
- Planes, límites y precios vienen de configuración server-side versionada. La propuesta COP del plan es experimental hasta validar con negocios; no publicarla como precio final sin aprobación del owner.
- Eventos de pago, reintentos, facturas/recibos y `provider_event_id` deben ser idempotentes y auditables.

## Experiencia y diseño

- Diseñar para belleza, uñas, estética, spa y barberías; lenguaje, perfiles e iconografía neutrales, sin asumir género del cliente o del personal.
- Desktop-first para el panel operativo, móvil-first para el portal; comprobar teclado, contraste, focus visible, texto largo, estados vacíos/error/carga y viewport estrecho.
- Panel y portal ofrecen tema claro/oscuro con preferencia persistida y lectura respetuosa del tema del sistema.
- Usar Lucide si resuelve iconografía; controles con labels accesibles, botones reales y estados disabled/loading.
- Evitar dashboards decorativos con métricas inventadas cuando se conecten datos reales. Cada KPI debe tener definición verificable.

## Calidad y colaboración

- Mantener TypeScript estricto y paquetes separados: `pnpm --filter v2 ...` para web y `pnpm --filter @alma/v2-api ...` para API.
- Cada operación de seguridad o tenancy debe tener pruebas positivas y negativas, incluyendo acceso cruzado entre dos negocios.
- Antes de cerrar una tarea que toque V2 ejecutar build/lint relevantes y pruebas del paquete afectado; actualizar `docs/V2_PLAN.md` con lo implementado y lo que falta.
- No incluir `.env`, claves, tokens, OTP, teléfonos o datos personales en Git, logs, capturas o documentación.
- Cambios destructivos de esquema requieren migración, plan de reversión y prueba de restauración antes de considerar el retiro de V1.
