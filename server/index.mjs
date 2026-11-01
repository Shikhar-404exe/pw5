/**
 * Mira's minimal backend.
 *
 * Responsibilities (and nothing more):
 *  1. Serve the built frontend from ./dist with safe path handling.
 *  2. Proxy AI chat-completions to an OpenAI-compatible provider, keeping the
 *     API key out of the browser bundle.
 *  3. Report capability status via /api/health (never exposing secrets).
 *
 * Zero dependencies. Node 18+ (uses global fetch).
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT || 8787);

const AI_BASE_URL = (process.env.MIRA_AI_BASE_URL || '').replace(/\/+$/, '');
const AI_API_KEY = process.env.MIRA_AI_API_KEY || '';
const AI_MODEL = process.env.MIRA_AI_MODEL || 'gpt-4o-mini';

const MAX_BODY_BYTES = 32 * 1024; // requests from the browser
const MAX_UPSTREAM_BYTES = 512 * 1024; // responses from the provider
const UPSTREAM_TIMEOUT_MS = 25_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...securityHeaders(),
  });
  res.end(body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(req, res, pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, securityHeaders());
    res.end('Forbidden');
    return;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // SPA fallback for client routes
    filePath = join(ROOT, 'index.html');
  }
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...securityHeaders() });
    res.end(data);
  } catch {
    res.writeHead(404, securityHeaders());
    res.end('Not found');
  }
}

function aiConfigured() {
  return AI_BASE_URL !== '' && AI_API_KEY !== '';
}

async function handleAi(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method-not-allowed' });
    return;
  }
  if (!aiConfigured()) {
    sendJson(res, 503, { error: 'ai_not_configured' });
    return;
  }
  let payload;
  try {
    const raw = await readBody(req, MAX_BODY_BYTES);
    payload = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: 'invalid-json' });
    return;
  }
  const message = typeof payload?.message === 'string' ? payload.message.slice(0, 2000) : '';
  if (!message) {
    sendJson(res, 400, { error: 'missing-message' });
    return;
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
      // Never leak provider details to the client.
      sendJson(res, 502, { error: 'provider-error', status: upstream.status });
      return;
    }
    if (text.length > MAX_UPSTREAM_BYTES) {
      sendJson(res, 502, { error: 'provider-response-too-large' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      sendJson(res, 502, { error: 'provider-invalid-json' });
      return;
    }
    const reply = parsed?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      sendJson(res, 502, { error: 'provider-missing-reply' });
      return;
    }
    sendJson(res, 200, { text: reply });
  } catch {
    sendJson(res, 504, { error: 'provider-timeout' });
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, aiConfigured: aiConfigured() });
    return;
  }
  if (url.pathname === '/api/ai') {
    await handleAi(req, res);
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not-found' });
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(
    `Mira running on http://localhost:${PORT} (AI ${aiConfigured() ? 'connected' : 'not configured - demo mode'})`,
  );
});
