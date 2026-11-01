const MAX_UPSTREAM_BYTES = 512 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method-not-allowed' });
  }

  const AI_BASE_URL = (process.env.MIRA_AI_BASE_URL || '').replace(/\/+$/, '');
  const AI_API_KEY = process.env.MIRA_AI_API_KEY || '';
  const AI_MODEL = process.env.MIRA_AI_MODEL || 'gpt-4o-mini';

  if (!AI_BASE_URL || !AI_API_KEY) {
    return res.status(503).json({ error: 'ai_not_configured' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: 'invalid-json' });
    }
  }

  const message = typeof payload?.message === 'string' ? payload.message.slice(0, 2000) : '';
  if (!message) {
    return res.status(400).json({ error: 'missing-message' });
  }

  const history = Array.isArray(payload?.history)
    ? payload.history
        .filter(
          (turn) =>
            turn && typeof turn.text === 'string' && (turn.role === 'user' || turn.role === 'mira'),
        )
        .slice(-6)
        .map((turn) => ({ role: turn.role, text: String(turn.text).slice(0, 500) }))
    : [];
  const system = typeof payload?.system === 'string' ? payload.system.slice(0, 4000) : '';
  const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};

  const upstreamBody = {
    model: AI_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: system },
      {
        role: 'system',
        content: `Current event profile (JSON): ${JSON.stringify(profile).slice(0, 2000)}`,
      },
      ...history.map((turn) => ({
        role: turn.role === 'user' ? 'user' : 'assistant',
        content: turn.text,
      })),
      { role: 'user', content: message },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(502).json({ error: 'provider-error', status: upstream.status });
    }
    if (text.length > MAX_UPSTREAM_BYTES) {
      return res.status(502).json({ error: 'provider-response-too-large' });
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'provider-invalid-json' });
    }
    const reply = parsed?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      return res.status(502).json({ error: 'provider-missing-reply' });
    }
    return res.status(200).json({ text: reply });
  } catch {
    return res.status(504).json({ error: 'provider-timeout' });
  } finally {
    clearTimeout(timer);
  }
}
