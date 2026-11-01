export default function handler(req, res) {
  const AI_BASE_URL = (process.env.MIRA_AI_BASE_URL || '').replace(/\/+$/, '');
  const AI_API_KEY = process.env.MIRA_AI_API_KEY || '';
  const configured = AI_BASE_URL !== '' && AI_API_KEY !== '';

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ ok: true, aiConfigured: configured });
}
