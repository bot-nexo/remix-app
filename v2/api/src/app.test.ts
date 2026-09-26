import { describe, expect, it } from 'vitest'
import { createApp, type IdentityProvider } from './app.js'

const businessA = '11111111-1111-4111-8111-111111111111'
const businessB = '22222222-2222-4222-8222-222222222222'
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeIdentityProvider(): IdentityProvider {
  return {
    async verifyAccessToken(token) {
      if (token === 'token-a') return { userId: userA }
      if (token === 'token-b') return { userId: userB }
      return null
    },
    async getMembership(userId, businessId) {
      if (userId === userA && businessId === businessA) return { role: 'owner' }
      if (userId === userB && businessId === businessB) return { role: 'staff' }
      return null
    },
  }
}

describe('business boundary', () => {
  it('allows a user with membership in their business', async () => {
    const app = createApp(makeIdentityProvider())
    const response = await app.request(`/v1/businesses/${businessA}/session`, {
      headers: { Authorization: 'Bearer token-a' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ businessId: businessA, userId: userA, role: 'owner' })
  })

  it('denies a valid user token from another business', async () => {
    const app = createApp(makeIdentityProvider())
    const response = await app.request(`/v1/businesses/${businessB}/session`, {
      headers: { Authorization: 'Bearer token-a' },
    })

    expect(response.status).toBe(403)
  })

  it('rejects missing and invalid sessions', async () => {
    const app = createApp(makeIdentityProvider())
    const missing = await app.request(`/v1/businesses/${businessA}/session`)
    const invalid = await app.request(`/v1/businesses/${businessA}/session`, {
      headers: { Authorization: 'Bearer forged-token' },
    })

    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
  })

  it('rejects malformed business identifiers before authorization', async () => {
    const app = createApp(makeIdentityProvider())
    const response = await app.request('/v1/businesses/not-a-uuid/session', {
      headers: { Authorization: 'Bearer token-a' },
    })

    expect(response.status).toBe(400)
  })

  it('allows configured web origins and rejects unconfigured origins', async () => {
    const app = createApp(makeIdentityProvider(), new Set(['https://web.example']))
    const allowed = await app.request('/health', { headers: { Origin: 'https://web.example' } })
    const denied = await app.request('/health', { headers: { Origin: 'https://other.example' } })

    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://web.example')
    expect(denied.status).toBe(403)
  })
})
