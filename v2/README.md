# Alma Studio Manager V2

V2 multi-negocio en desarrollo. Angel Nails es el primer negocio de muestra. Esta aplicación vive dentro de `v2/` y no reemplaza ni modifica el build de V1.

## Paquetes

- `v2/`: panel y portal cliente con React, TypeScript y Vite.
- `v2/api/`: API Node.js/TypeScript con Hono, validación de sesiones Supabase y control de membresía por negocio.
- `v2/api/migrations/0001_business_core.sql`: esquema inicial multi-negocio, RLS, relaciones acotadas por negocio y restricción de solapamiento.

## Desarrollo local

Desde la raíz del repositorio:

```powershell
pnpm install
pnpm --filter v2 dev
pnpm --filter v2 build
pnpm --filter v2 lint
pnpm --filter @alma/v2-api test
pnpm --filter @alma/v2-api build
```

El panel y portal de demostración se sirven en `http://localhost:5173`; el portal está en `/reservar/angel-nails`. El tema claro/oscuro se comparte entre ambas vistas y se guarda localmente.

La API requiere `v2/api/.env`, creado desde `.env.example`. No copies claves de V1 ni añadas secretos al frontend. En local usa un proyecto Supabase de desarrollo, no la base productiva.

## Estado funcional

El panel contiene agenda, indicadores, vistas de clientes/servicios/horarios/WhatsApp y un alta local de muestra. El portal permite recorrer catálogo, seleccionar fecha/hora, confirmar y gestionar citas locales. **Estos datos son de demostración y no se guardan en una base real.**

La API actual expone `/health` y una comprobación de sesión por negocio bajo `/v1/businesses/:businessId/session`. La migración se probó en PostgreSQL 15 temporal; aún no se ha aplicado a Supabase ni se han cargado secretos reales.

## Seguridad y siguientes pasos

- Cada petición de negocio valida un token Supabase y una membresía `active`.
- `service_role` solo vive en el servidor.
- Hay pruebas de acceso permitido, aislamiento A/B, sesión inválida, UUID inválido y CORS.
- Antes de conectar pantallas, completar verificación OTP de cliente, creación segura del primer negocio/membresía, endpoints transaccionales de citas y pruebas concurrentes.
- No aplicar la migración productiva ni retirar V1 hasta ensayar importación, respaldo y rollback.

La hoja de ruta viva está en [`../docs/V2_PLAN.md`](../docs/V2_PLAN.md).

Las reglas permanentes para trabajar en V2 están en [`AGENTS.md`](AGENTS.md).
    "react/rules-of-hooks": "error",
