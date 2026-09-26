import { serve } from '@hono/node-server'
import { createClient } from '@supabase/supabase-js'
import { createApp, type IdentityProvider } from './app.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY son obligatorias.')
}

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const databaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const identityProvider: IdentityProvider = {
  async verifyAccessToken(token) {
    const { data, error } = await authClient.auth.getUser(token)
    return error || !data.user ? null : { userId: data.user.id }
  },
  async getMembership(userId, businessId) {
    const { data, error } = await databaseClient
      .from('business_memberships')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data || !['owner', 'admin', 'staff'].includes(data.role)) return null
    return { role: data.role }
  },
}

const allowedOrigins = new Set((process.env.WEB_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean))
const app = createApp(identityProvider, allowedOrigins)

const port = Number(process.env.PORT || 3001)
serve({ fetch: app.fetch, port, hostname: process.env.HOST || '0.0.0.0' })
