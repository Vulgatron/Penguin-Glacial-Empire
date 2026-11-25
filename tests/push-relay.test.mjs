import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRelayHandlers,
  createRateLimiter,
  validatePushEndpoint,
  isWithinReminderWindow
} from '../push-relay/relay-core.js';

function createMockKv() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      const val = store.get(key);
      return type === 'json' ? JSON.parse(val) : val;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true
      };
    }
  };
}

const VALID_SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example-token-123456',
  expirationTime: null,
  keys: {
    p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    auth: 'tBHItJI5svbpez7KI4CCXg=='
  }
};

function createEnv(overrides = {}) {
  return {
    ALLOWED_ORIGIN: 'https://glacial-empire.example.com',
    VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    VAPID_PRIVATE_KEY: 'test-private-key-placeholder-at-least-32-chars',
    PUSH_SUBSCRIPTIONS: createMockKv(),
    ...overrides
  };
}

test('Push Relay: enforces strict production CORS (fail-closed) and allows configured origins', async () => {
  const relay = createRelayHandlers({ sendWebPushFn: async () => ({ ok: true, status: 201 }) });
  const env = createEnv();

  // Disallowed origin -> 403
  const badOriginReq = new Request('https://relay.example.com/subscribe', {
    method: 'POST',
    headers: {
      'Origin': 'https://evil.attacker.test',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subscription: VALID_SUB })
  });
  const badRes = await relay.fetch(badOriginReq, env);
  assert.equal(badRes.status, 403);
  assert.equal(badRes.headers.get('Access-Control-Allow-Origin'), null);

  // Unconfigured ALLOWED_ORIGIN with Origin header -> 403 fail-closed
  const unconfiguredEnv = createEnv({ ALLOWED_ORIGIN: '' });
  const failClosedRes = await relay.fetch(badOriginReq, unconfiguredEnv);
  assert.equal(failClosedRes.status, 403);

  // Allowed origin OPTIONS -> 204 with exact origin reflection
  const preflight = new Request('https://relay.example.com/subscribe', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://glacial-empire.example.com' }
  });
  const preflightRes = await relay.fetch(preflight, env);
  assert.equal(preflightRes.status, 204);
  assert.equal(preflightRes.headers.get('Access-Control-Allow-Origin'), 'https://glacial-empire.example.com');
});

test('Push Relay: blocks SSRF private/loopback/HTTP/credentialed endpoints', () => {
  assert.equal(validatePushEndpoint('http://fcm.googleapis.com/send/abc').valid, false);
  assert.equal(validatePushEndpoint('https://127.0.0.1/send').valid, false);
  assert.equal(validatePushEndpoint('https://169.254.169.254/latest/meta-data/').valid, false);
  assert.equal(validatePushEndpoint('https://10.0.0.5/internal').valid, false);
  assert.equal(validatePushEndpoint('https://localhost:8443/hook').valid, false);
  assert.equal(validatePushEndpoint('https://user:pass@fcm.googleapis.com/send/abc').valid, false);
  assert.equal(validatePushEndpoint('https://[::1]/send').valid, false);
  assert.equal(validatePushEndpoint(VALID_SUB.endpoint).valid, true);
  assert.equal(validatePushEndpoint(VALID_SUB.endpoint, { strictKnownServices: true }).valid, true);
  assert.equal(validatePushEndpoint('https://unknown-host.example.com/push', { strictKnownServices: true }).valid, false);
});

test('Push Relay: enforces 8 KB payload limit and per-IP rate limiting', async () => {
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
  const relay = createRelayHandlers({
    sendWebPushFn: async () => ({ ok: true, status: 201 }),
    rateLimiter: limiter
  });
  const env = createEnv();

  // Oversized payload (> 8 KB) -> 413
  const bigBody = JSON.stringify({ subscription: VALID_SUB, padding: 'A'.repeat(9000) });
  const bigReq = new Request('https://relay.example.com/subscribe', {
    method: 'POST',
    headers: {
      'Origin': 'https://glacial-empire.example.com',
      'CF-Connecting-IP': '203.0.113.10',
      'Content-Type': 'application/json'
    },
    body: bigBody
  });
  const bigRes = await relay.fetch(bigReq, env);
  assert.equal(bigRes.status, 413);

  // Second request within limit -> 200
  const okReq = () => new Request('https://relay.example.com/subscribe', {
    method: 'POST',
    headers: {
      'Origin': 'https://glacial-empire.example.com',
      'CF-Connecting-IP': '203.0.113.10',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subscription: VALID_SUB, timeZone: 'UTC', reminderHour: 8, reminderMinute: 30 })
  });
  const secondRes = await relay.fetch(okReq(), env);
  assert.equal(secondRes.status, 200);

  // Third request from same IP -> 429 Too Many Requests
  const thirdRes = await relay.fetch(okReq(), env);
  assert.equal(thirdRes.status, 429);
  assert.ok(Number(thirdRes.headers.get('Retry-After')) >= 1);
});

test('Push Relay: subscribe/unsubscribe lifecycle, 15-min window with reminderMinute, duplicate prevention, and 410 pruning', async () => {
  const sentTo = [];
  let nextPushResponse = { ok: true, status: 201 };
  const relay = createRelayHandlers({
    sendWebPushFn: async (record) => {
      sentTo.push(record.subscription.endpoint);
      return nextPushResponse;
    },
    logger: { warn() {} }
  });
  const env = createEnv();

  // Subscribe for 08:30 UTC
  const subRes = await relay.fetch(new Request('https://relay.example.com/subscribe', {
    method: 'POST',
    headers: { 'Origin': 'https://glacial-empire.example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: VALID_SUB,
      timeZone: 'UTC',
      tzOffsetMinutes: 0,
      reminderHour: 8,
      reminderMinute: 30
    })
  }), env);
  assert.equal(subRes.status, 200);
  const subJson = await subRes.json();
  assert.equal(subJson.reminderHour, 8);
  assert.equal(subJson.reminderMinute, 30);
  assert.equal(env.PUSH_SUBSCRIPTIONS.store.size, 1);

  // Verify 15-minute window helper directly
  assert.equal(isWithinReminderWindow({ hour: 8, minute: 15 }, 8, 30), false);
  assert.equal(isWithinReminderWindow({ hour: 8, minute: 30 }, 8, 30), true);
  assert.equal(isWithinReminderWindow({ hour: 8, minute: 44 }, 8, 30), true);
  assert.equal(isWithinReminderWindow({ hour: 8, minute: 45 }, 8, 30), false);

  // Cron at 08:15 UTC -> should NOT send yet
  const statsEarly = await relay.dispatchScheduled(env, new Date('2026-05-15T08:15:00Z'));
  assert.equal(statsEarly.sent, 0);

  // Cron at 08:35 UTC -> inside 15-min window -> sends once
  const statsHit = await relay.dispatchScheduled(env, new Date('2026-05-15T08:35:00Z'));
  assert.equal(statsHit.sent, 1);
  assert.equal(sentTo.length, 1);

  // Cron at 08:40 UTC same day -> skipped (no duplicate)
  const statsDup = await relay.dispatchScheduled(env, new Date('2026-05-15T08:40:00Z'));
  assert.equal(statsDup.sent, 0);

  // Next day at 08:30 UTC with 410 Gone -> automatically pruned from KV
  nextPushResponse = { ok: false, status: 410 };
  const statsPrune = await relay.dispatchScheduled(env, new Date('2026-05-16T08:30:00Z'));
  assert.equal(statsPrune.pruned, 1);
  assert.equal(env.PUSH_SUBSCRIPTIONS.store.size, 0);

  // Missing VAPID secrets -> safely skipped without crashing
  const unconfStats = await relay.dispatchScheduled(createEnv({ VAPID_PRIVATE_KEY: '' }), new Date('2026-05-16T08:30:00Z'));
  assert.equal(unconfStats.skippedUnconfigured, true);
});
