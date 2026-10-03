'use strict';

const crypto = require('crypto');

function verifyEvolutionWebhookToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096 || typeof secret !== 'string' || secret.length < 32) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || claims.app !== 'evolution' || claims.action !== 'webhook') return false;

    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

    const nowSeconds = Math.floor(now / 1000);
    return Number.isInteger(claims.iat) && Number.isInteger(claims.exp) &&
      claims.iat <= nowSeconds + 60 && claims.exp > nowSeconds &&
      claims.exp > claims.iat && claims.exp - claims.iat <= 660;
  } catch {
    return false;
  }
}

module.exports = { verifyEvolutionWebhookToken };
