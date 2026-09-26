import { Hono } from 'hono'

export type MembershipRole = 'owner' | 'admin' | 'staff'

export type IdentityProvider = {
  verifyAccessToken: (token: string) => Promise<{ userId: string } | null>
  getMembership: (userId: string, businessId: string) => Promise<{ role: MembershipRole } | null>
}

type Variables = {
  userId: string
  businessId: string
  membershipRole: MembershipRole
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createApp(identityProvider: IdentityProvider, allowedOrigins = new Set<string>()) {
  const app = new Hono<{ Variables: Variables }>()

  app.use('*', async (context, next) => {
    const origin = context.req.header('Origin')
    if (origin && !allowedOrigins.has(origin)) return context.json({ error: 'Origen no permitido.' }, 403)
    if (origin) {
      context.header('Access-Control-Allow-Origin', origin)
      context.header('Vary', 'Origin')
      context.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      context.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204)
    await next()
  })

  app.get('/health', (context) => context.json({ status: 'ok' }))

  app.use('/v1/businesses/:businessId/*', async (context, next) => {
    const businessId = context.req.param('businessId')
    if (!uuidPattern.test(businessId)) {
      return context.json({ error: 'Identificador de negocio inválido.' }, 400)
    }

    const authorization = context.req.header('Authorization')
    const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1]
    if (!token) return context.json({ error: 'Autenticación requerida.' }, 401)

    try {
      const identity = await identityProvider.verifyAccessToken(token)
      if (!identity) return context.json({ error: 'Sesión inválida o expirada.' }, 401)

      const membership = await identityProvider.getMembership(identity.userId, businessId)
      if (!membership) return context.json({ error: 'No tienes acceso a este negocio.' }, 403)

      context.set('userId', identity.userId)
      context.set('businessId', businessId)
      context.set('membershipRole', membership.role)
      await next()
    } catch {
      return context.json({ error: 'No se pudo validar el acceso.' }, 503)
    }
  })

  app.get('/v1/businesses/:businessId/session', (context) => context.json({
    businessId: context.get('businessId'),
    userId: context.get('userId'),
    role: context.get('membershipRole'),
  }))

  return app
}
