import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from './_supabase.js';
import { freePlan } from './_teaser.js';
import { capForecast } from './_income.js';
import { buildPlanPrompts } from './_plan-prompt.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best effort per-instance limit: each call costs a Claude request and a new DB row
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  for (const [key, h] of hits) if (now - h.start > RATE_WINDOW_MS) hits.delete(key);
  const h = hits.get(ip) || { start: now, count: 0 };
  h.count++;
  hits.set(ip, h);
  return h.count > RATE_LIMIT;
}

function allowedOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(hostname)
      || hostname === 'getbizidea.com' || hostname.endsWith('.getbizidea.com')
      || hostname.endsWith('.vercel.app');
  } catch { return false; }
}

// Quiz answers end up in the prompt and the DB, so only short strings get through
function cleanQuizData(raw) {
  const clean = {};
  for (const key of ['age', 'location', 'lifestyle', 'time', 'budget', 'strengths', 'interests', 'btype', 'income', 'risk', 'asked_for', 'language']) {
    const value = raw?.[key];
    clean[key] = Array.isArray(value)
      ? value.slice(0, 12).map(v => String(v).slice(0, 80)).join(', ')
      : String(value ?? '').slice(0, 200);
  }
  const attr = raw?.attribution;
  if (attr && typeof attr === 'object') {
    clean.attribution = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'landing']) {
      if (attr[key]) clean.attribution[key] = String(attr[key]).slice(0, 120);
    }
  }
  return clean;
}

// Extract first complete balanced JSON object from text (ignores trailing garbage)
function extractFirstJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Basic origin check to prevent external abuse of Claude API
  if (!allowedOrigin(req.headers.origin || req.headers.referer || '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many plans generated. Please try again in a few minutes.' });
  }

  const quizData = cleanQuizData(req.body?.quizData);
  const { system: systemPrompt, user: userPrompt } = buildPlanPrompts(quizData);

  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Find text block (skip thinking blocks from extended-thinking models)
    const textBlock = msg.content.find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(200).json({ error: 'RAW_CONTENT:' + JSON.stringify(msg.content).slice(0, 300) });
    }
    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    // Extract first COMPLETE balanced JSON object (stops at first matching close brace)
    const jsonStr = extractFirstJson(cleaned);
    if (!jsonStr) {
      return res.status(200).json({ error: 'NO_JSON:' + cleaned.slice(0, 300) });
    }
    const plan = JSON.parse(jsonStr);
    if (plan.top_idea) capForecast(plan.top_idea.income_forecast, quizData.time);

    let resultId = null;
    let dbError = null;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('results').insert({
        quiz_data: quizData, plan, language: quizData.language || 'en'
      }).select('id').single();
      if (error) { dbError = error.message || JSON.stringify(error); console.error('DB error:', error); }
      resultId = data?.id;
    } catch (e) {
      dbError = e.message;
      console.error('DB exception:', e.message);
    }

    // Full plan is stored in DB; client only gets the free preview until paid (see /api/result)
    res.json({ resultId, plan: freePlan(plan), dbError });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
