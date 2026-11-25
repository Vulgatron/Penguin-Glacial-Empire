/**
 * Pure, dependency-free core logic for the Penguin Glacial Empire Cloudflare Push Relay.
 * Handles:
 * - Production CORS enforcement (rejects disallowed origins; avoids open wildcard fallback)
 * - Request body size limits & JSON parsing
 * - Lightweight sliding-window rate limiting (per IP/client key)
 * - Strict PushSubscription & HTTPS endpoint validation (blocks non-HTTPS, credentials, localhost/private/metadata IPs)
 * - 15-minute window reminder matching respecting BOTH reminderHour and reminderMinute
 * - Expired subscription cleanup (404 / 410) and structured diagnostics
 */

export const MAX_REQUEST_BYTES = 8 * 1024; // 8 KB max JSON payload
export const RATE_LIMIT_MAX_REQUESTS = 30; // max requests per IP per window
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
export const REMINDER_WINDOW_MINUTES = 15; // matches wrangler.toml */15 cron

const ALLOWED_PUSH_HOST_SUFFIXES = [
  'push.apple.com',
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'wns.windows.com',
  'web.push.apple.com'
];

export function parseAllowedOrigins(env) {
  const raw = (env && typeof env.ALLOWED_ORIGIN === 'string') ? env.ALLOWED_ORIGIN : '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '*');
}

export function resolveCors(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedList = parseAllowedOrigins(env);
  const allowDevWildcard = Boolean(env && env.ALLOW_DEV_CORS === 'true');

  let allowOrigin = '';
  let originAllowed = true;

  if (allowedList.length > 0) {
    if (!requestOrigin) {
      allowOrigin = allowedList[0];
      originAllowed = true;
    } else if (allowedList.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
      originAllowed = true;
    } else {
      originAllowed = false;
    }
  } else if (allowDevWildcard) {
    allowOrigin = requestOrigin || '*';
    originAllowed = true;
  } else {
    // Production fail-closed: require explicit ALLOWED_ORIGIN when Origin header is present
    if (requestOrigin) {
      originAllowed = false;
    }
  }

  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  return { originAllowed, headers };
}

export function isPrivateOrUnsafeHost(host) {
  const clean = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!clean) return true;
  if (
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    clean.endsWith('.local') ||
    clean.endsWith('.internal')
  ) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    const parts = clean.split('.').map(Number);
    if (parts.some((n) => n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (clean.includes(':')) {
    if (clean === '::1' || clean === '::' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
      return true;
    }
  }
  return false;
}

export function validatePushEndpoint(endpoint, { strictKnownServices = false } = {}) {
  if (typeof endpoint !== 'string') {
    return { valid: false, reason: 'Endpoint must be a string' };
  }
  const trimmed = endpoint.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { valid: false, reason: 'Endpoint length out of bounds' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return { valid: false, reason: 'Malformed endpoint URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Push endpoint must use HTTPS' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Credentials in push endpoint are forbidden' };
  }
  if (isPrivateOrUnsafeHost(parsed.hostname)) {
    return { valid: false, reason: 'Private or loopback push endpoint rejected' };
  }
  if (strictKnownServices) {
    const host = parsed.hostname.toLowerCase();
    const matched = ALLOWED_PUSH_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith('.' + suffix)
    );
    if (!matched) {
      return { valid: false, reason: 'Unrecognized push service host' };
    }
  }
  return { valid: true, endpoint: parsed.toString() };
}

export function validateBase64Key(val, minLen = 16, maxLen = 256) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length >= minLen && trimmed.length <= maxLen && /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed);
}

export function validateTimeZone(tz) {
  if (typeof tz !== 'string' || !tz.trim() || tz.length > 64) return 'UTC';
  const clean = tz.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: clean });
    return clean;
  } catch (_) {
    return 'UTC';
  }
}

export function validateSubscribePayload(body, options = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  const sub = body.subscription;
  if (!sub || typeof sub !== 'object' || !sub.keys || typeof sub.keys !== 'object') {
    return { valid: false, error: 'Invalid PushSubscription structure' };
  }
  const endpointCheck = validatePushEndpoint(sub.endpoint, options);
  if (!endpointCheck.valid) {
    return { valid: false, error: endpointCheck.reason };
  }
  if (!validateBase64Key(sub.keys.p256dh, 64, 256) || !validateBase64Key(sub.keys.auth, 16, 128)) {
    return { valid: false, error: 'Invalid PushSubscription encryption keys' };
  }

  const reminderHour = Number.isInteger(body.reminderHour) && body.reminderHour >= 0 && body.reminderHour <= 23
    ? body.reminderHour
    : 8;
  const reminderMinute = Number.isInteger(body.reminderMinute) && body.reminderMinute >= 0 && body.reminderMinute <= 59
    ? body.reminderMinute
    : 0;
  const tzOffsetMinutes = typeof body.tzOffsetMinutes === 'number' && Number.isFinite(body.tzOffsetMinutes)
    ? Math.max(-840, Math.min(840, Math.round(body.tzOffsetMinutes)))
    : 0;
  const timeZone = validateTimeZone(body.timeZone);

  return {
    valid: true,
    record: {
      subscription: {
        endpoint: endpointCheck.endpoint,
        expirationTime: typeof sub.expirationTime === 'number' ? sub.expirationTime : null,
        keys: {
          p256dh: sub.keys.p256dh.trim(),
          auth: sub.keys.auth.trim()
        }
      },
      timeZone,
      tzOffsetMinutes,
      reminderHour,
      reminderMinute
    }
  };
}

export async function readBoundedJson(request, maxBytes = MAX_REQUEST_BYTES) {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, status: 413, error: 'Payload too large' };
    }
  }
  const text = await request.text();
  const byteLen = new TextEncoder().encode(text).length;
  if (byteLen === 0) {
    return { ok: false, status: 400, error: 'Empty request body' };
  }
  if (byteLen > maxBytes) {
    return { ok: false, status: 413, error: 'Payload too large' };
  }
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (_) {
    return { ok: false, status: 400, error: 'Malformed JSON body' };
  }
}

export function createRateLimiter({
  maxRequests = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS
} = {}) {
  const buckets = new Map();

  return {
    check(clientKey, nowMs = Date.now()) {
      const key = String(clientKey || 'unknown').slice(0, 128);
      const entry = buckets.get(key);
      if (!entry || (nowMs - entry.windowStart) >= windowMs) {
        buckets.set(key, { windowStart: nowMs, count: 1 });
        // Prune stale buckets opportunistically to keep memory bounded
        if (buckets.size > 500) {
          for (const [k, v] of buckets.entries()) {
            if ((nowMs - v.windowStart) >= windowMs) buckets.delete(k);
          }
        }
        return { allowed: true, remaining: maxRequests - 1, retryAfterSec: 0 };
      }

      if (entry.count >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((windowMs - (nowMs - entry.windowStart)) / 1000));
        return { allowed: false, remaining: 0, retryAfterSec };
      }

      entry.count += 1;
      return { allowed: true, remaining: maxRequests - entry.count, retryAfterSec: 0 };
    },
    reset() {
      buckets.clear();
    }
  };
}

export function getLocalClock(now, timeZone, tzOffsetMinutes) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(now);

      const map = {};
      for (const p of parts) map[p.type] = p.value;
      const hour = Number(map.hour) === 24 ? 0 : Number(map.hour);
      const minute = Number(map.minute);
      const dateKey = `${map.year}-${map.month}-${map.day}`;
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        return { dateKey, hour, minute };
      }
    } catch (_) {
      // Fall back to numeric timezone offset if unknown IANA zone
    }
  }

  const offsetMs = (typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0) * 60000;
  const shifted = new Date(now.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    dateKey: `${y}-${m}-${d}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

/**
 * Matches the user's configured (reminderHour, reminderMinute) against the current local clock
 * within a 15-minute cron dispatch window, avoiding both missed reminders and duplicate sends.
 */
export function isWithinReminderWindow(clock, targetHour, targetMinute, windowMinutes = REMINDER_WINDOW_MINUTES) {
  const curMin = (clock.hour * 60) + clock.minute;
  const h = Number.isInteger(targetHour) && targetHour >= 0 && targetHour <= 23 ? targetHour : 8;
  const m = Number.isInteger(targetMinute) && targetMinute >= 0 && targetMinute <= 59 ? targetMinute : 0;
  const tgtMin = (h * 60) + m;
  const diff = (curMin - tgtMin + 1440) % 1440;
  return diff >= 0 && diff < windowMinutes;
}

export async function subscriptionKey(endpoint) {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sub_' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isVapidConfigured(env) {
  return Boolean(
    env &&
    typeof env.VAPID_PUBLIC_KEY === 'string' && env.VAPID_PUBLIC_KEY.trim().length >= 32 &&
    typeof env.VAPID_PRIVATE_KEY === 'string' && env.VAPID_PRIVATE_KEY.trim().length >= 32
  );
}

/**
 * Factory creating testable Cloudflare Worker fetch() and scheduled() handlers.
 */
export function createRelayHandlers({ sendWebPushFn, rateLimiter = createRateLimiter(), logger = console } = {}) {
  return {
    async fetch(request, env) {
      const { originAllowed, headers } = resolveCors(request, env);

      if (request.method === 'OPTIONS') {
        if (!originAllowed) {
          return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
        }
        return new Response(null, { status: 204, headers });
      }

      if (!originAllowed) {
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
      }

      const url = new URL(request.url);

      if (request.method === 'GET' && (url.pathname === '/' || url.pathname.endsWith('/health'))) {
        return new Response(JSON.stringify({
          ok: true,
          service: 'penguin-push-relay',
          vapidConfigured: isVapidConfigured(env),
          kvBound: Boolean(env && env.PUSH_SUBSCRIPTIONS),
          corsConfigured: parseAllowedOrigins(env).length > 0
        }), { status: 200, headers });
      }

      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
      }

      const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'anonymous';
      const rl = rateLimiter.check(clientIp);
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { ...headers, 'Retry-After': String(rl.retryAfterSec) }
        });
      }

      if (!env || !env.PUSH_SUBSCRIPTIONS) {
        return new Response(JSON.stringify({ error: 'Push subscription storage is not configured' }), {
          status: 503,
          headers
        });
      }

      const parsedBody = await readBoundedJson(request);
      if (!parsedBody.ok) {
        return new Response(JSON.stringify({ error: parsedBody.error }), {
          status: parsedBody.status,
          headers
        });
      }

      if (url.pathname.endsWith('/subscribe')) {
        const strictHosts = env.STRICT_PUSH_HOSTS === 'true';
        const validation = validateSubscribePayload(parsedBody.data, { strictKnownServices: strictHosts });
        if (!validation.valid) {
          return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers });
        }

        const key = await subscriptionKey(validation.record.subscription.endpoint);
        const existing = await env.PUSH_SUBSCRIPTIONS.get(key, 'json');
        const record = {
          ...validation.record,
          lastSentDateKey: existing && typeof existing.lastSentDateKey === 'string' ? existing.lastSentDateKey : '',
          createdAt: existing && typeof existing.createdAt === 'number' ? existing.createdAt : Date.now(),
          updatedAt: Date.now()
        };

        await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(record));
        return new Response(JSON.stringify({
          ok: true,
          reminderHour: record.reminderHour,
          reminderMinute: record.reminderMinute,
          timeZone: record.timeZone
        }), { status: 200, headers });
      }

      if (url.pathname.endsWith('/unsubscribe')) {
        const body = parsedBody.data;
        const endpoint = body && (body.endpoint || (body.subscription && body.subscription.endpoint));
        const endpointCheck = validatePushEndpoint(endpoint);
        if (!endpointCheck.valid) {
          return new Response(JSON.stringify({ error: endpointCheck.reason }), { status: 400, headers });
        }
        const key = await subscriptionKey(endpointCheck.endpoint);
        await env.PUSH_SUBSCRIPTIONS.delete(key);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    },

    async dispatchScheduled(env, now = new Date()) {
      const stats = { scanned: 0, matched: 0, sent: 0, pruned: 0, failed: 0, skippedUnconfigured: false };

      if (!env || !env.PUSH_SUBSCRIPTIONS || !isVapidConfigured(env)) {
        stats.skippedUnconfigured = true;
        if (logger && logger.warn) {
          logger.warn('[push-relay] Scheduled dispatch skipped: missing KV binding or VAPID secrets');
        }
        return stats;
      }

      let cursor = undefined;
      do {
        const page = await env.PUSH_SUBSCRIPTIONS.list({ cursor, limit: 100 });
        cursor = page.list_complete ? undefined : page.cursor;

        for (const item of page.keys) {
          stats.scanned++;
          const record = await env.PUSH_SUBSCRIPTIONS.get(item.name, 'json');
          if (!record || !record.subscription || !validatePushEndpoint(record.subscription.endpoint).valid) {
            // Clean up invalid/corrupted KV entries automatically
            await env.PUSH_SUBSCRIPTIONS.delete(item.name);
            stats.pruned++;
            continue;
          }

          const targetHour = Number.isInteger(record.reminderHour) ? record.reminderHour : 8;
          const targetMinute = Number.isInteger(record.reminderMinute) ? record.reminderMinute : 0;
          const clock = getLocalClock(now, record.timeZone, record.tzOffsetMinutes);

          if (record.lastSentDateKey === clock.dateKey) continue;
          if (!isWithinReminderWindow(clock, targetHour, targetMinute, REMINDER_WINDOW_MINUTES)) continue;

          stats.matched++;
          try {
            const res = await sendWebPushFn(
              record,
              {
                title: '🎯 Daily Goals Ready — Glacial Empire',
                body: 'Good morning! Complete today’s penguin colony tasks to earn bonus Fish & Frost Essence.',
                icon: './icons/icon-192.png',
                badge: './icons/icon-192.png',
                tag: 'daily-goals-reminder',
                url: './?tab=daily'
              },
              env
            );

            if (res && (res.status === 404 || res.status === 410)) {
              await env.PUSH_SUBSCRIPTIONS.delete(item.name);
              stats.pruned++;
            } else if (res && res.ok) {
              record.lastSentDateKey = clock.dateKey;
              record.lastSentAt = now.getTime();
              await env.PUSH_SUBSCRIPTIONS.put(item.name, JSON.stringify(record));
              stats.sent++;
            } else {
              stats.failed++;
              if (logger && logger.warn) {
                logger.warn('[push-relay] Push send returned non-OK status:', res ? res.status : 'no_response');
              }
            }
          } catch (err) {
            stats.failed++;
            if (logger && logger.warn) {
              logger.warn('[push-relay] Push send exception:', err && err.message ? err.message : 'unknown');
            }
          }
        }
      } while (cursor);

      return stats;
    }
  };
}
