import { buildPushPayload } from '@block65/webcrypto-web-push';
import { createRelayHandlers, createRateLimiter } from './relay-core.js';

async function sendWebPush(record, payloadObj, env) {
  // Private VAPID key is loaded strictly from Cloudflare Worker Secrets (never client-exposed)
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

const handlers = createRelayHandlers({
  sendWebPushFn: sendWebPush,
  rateLimiter: createRateLimiter()
});

export default {
  async fetch(request, env) {
    return handlers.fetch(request, env);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(handlers.dispatchScheduled(env, new Date()));
  }
};
