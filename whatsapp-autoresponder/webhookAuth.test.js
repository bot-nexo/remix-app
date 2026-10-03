'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { verifyEvolutionWebhookToken } = require('./webhookAuth');

const secret = 'a'.repeat(64);
const now = Date.UTC(2026, 9, 2, 12, 0, 0);

function signToken(claims, signingSecret = secret, algorithm = 'HS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function validClaims() {
  const iat = Math.floor(now / 1000);
  return { iat, exp: iat + 600, app: 'evolution', action: 'webhook' };
}

test('accepts an unexpired Evolution webhook JWT signed with the shared key', () => {
  assert.equal(verifyEvolutionWebhookToken(signToken(validClaims()), secret, now), true);
});

test('rejects a token with a modified signature', () => {
  const token = signToken(validClaims());
  const [header, payload] = token.split('.');
  assert.equal(verifyEvolutionWebhookToken(`${header}.${payload}.${'A'.repeat(43)}`, secret, now), false);
});

test('rejects expired, wrong-purpose, and non-HS256 tokens', () => {
  const expired = validClaims();
  expired.exp = Math.floor(now / 1000) - 1;
  assert.equal(verifyEvolutionWebhookToken(signToken(expired), secret, now), false);

  const wrongPurpose = { ...validClaims(), action: 'other' };
  assert.equal(verifyEvolutionWebhookToken(signToken(wrongPurpose), secret, now), false);
  assert.equal(verifyEvolutionWebhookToken(signToken(validClaims(), secret, 'none'), secret, now), false);
});

test('rejects malformed tokens and weak secrets', () => {
  assert.equal(verifyEvolutionWebhookToken('not-a-jwt', secret, now), false);
  assert.equal(verifyEvolutionWebhookToken(signToken(validClaims()), 'short', now), false);
});
