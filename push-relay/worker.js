import { buildPushPayload } from '@block65/webcrypto-web-push';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

async function subscriptionKey(endpoint) {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sub_' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function getLocalClock(now, timeZone, tzOffsetMinutes) {
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

  const offsetMs = (typeof tzOffsetMinutes === 'number' ? tzOffsetMinutes : 0) * 60000;
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

async function sendWebPush(record, payloadObj, env) {
  const vapid = {
    subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };

  const req = await buildPushPayload(
    {
      data: JSON.stringify(payloadObj),
      options: { ttl: 3600, urgency: 'normal' }
    },
    record.subscription,
    vapid
  );

  return fetch(req.endpoint, {
    method: 'POST',
    headers: req.init.headers,
    body: req.init.body
  });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.endsWith('/subscribe')) {
      try {
        const body = await request.json();
        const sub = body && body.subscription;
        if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          return new Response(JSON.stringify({ error: 'Invalid PushSubscription' }), { status: 400, headers });
        }

        const key = await subscriptionKey(sub.endpoint);
        const existing = await env.PUSH_SUBSCRIPTIONS.get(key, 'json');
        const record = {
          subscription: sub,
          timeZone: typeof body.timeZone === 'string' ? body.timeZone : 'UTC',
          tzOffsetMinutes: typeof body.tzOffsetMinutes === 'number' ? body.tzOffsetMinutes : 0,
          reminderHour: typeof body.reminderHour === 'number' ? body.reminderHour : 8,
          reminderMinute: typeof body.reminderMinute === 'number' ? body.reminderMinute : 0,
          lastSentDateKey: existing && existing.lastSentDateKey ? existing.lastSentDateKey : '',
          updatedAt: Date.now()
        };

        await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(record));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Bad request' }), { status: 400, headers });
      }
    }

    if (request.method === 'POST' && url.pathname.endsWith('/unsubscribe')) {
      try {
        const body = await request.json();
        const endpoint = body && (body.endpoint || (body.subscription && body.subscription.endpoint));
        if (!endpoint) {
          return new Response(JSON.stringify({ error: 'Missing endpoint' }), { status: 400, headers });
        }
        const key = await subscriptionKey(endpoint);
        await env.PUSH_SUBSCRIPTIONS.delete(key);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Bad request' }), { status: 400, headers });
      }
    }

    return new Response(JSON.stringify({ ok: true, service: 'penguin-push-relay' }), { status: 200, headers });
  },

  async scheduled(_controller, env, ctx) {
    const now = new Date();

    const runDispatch = async () => {
      let cursor = undefined;
      do {
        const page = await env.PUSH_SUBSCRIPTIONS.list({ cursor, limit: 100 });
        cursor = page.list_complete ? undefined : page.cursor;

        for (const item of page.keys) {
          const record = await env.PUSH_SUBSCRIPTIONS.get(item.name, 'json');
          if (!record || !record.subscription) continue;

          const targetHour = typeof record.reminderHour === 'number' ? record.reminderHour : 8;
          const clock = getLocalClock(now, record.timeZone, record.tzOffsetMinutes);

          // Deliver once per local day during the user's 8:00 AM hour
          if (clock.hour === targetHour && record.lastSentDateKey !== clock.dateKey) {
            try {
              const res = await sendWebPush(
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

              if (res.status === 404 || res.status === 410) {
                await env.PUSH_SUBSCRIPTIONS.delete(item.name);
              } else if (res.ok) {
                record.lastSentDateKey = clock.dateKey;
                await env.PUSH_SUBSCRIPTIONS.put(item.name, JSON.stringify(record));
              }
            } catch (_) {
              // Retry on next 15-minute cron tick within the 8:00 AM hour
            }
          }
        }
      } while (cursor);
    };

    ctx.waitUntil(runDispatch());
  }
};
