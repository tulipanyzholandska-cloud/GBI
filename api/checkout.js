import Stripe from 'stripe';
import { getSupabase } from './_supabase.js';
import { PLAN_CONTENT } from './_plan-content.js';

const READY_MADE_PLAN_PRICE_CENTS = 1700;
// Stripe metadata: which channel this sale came from
function attributionMetadata(attr) {
  const meta = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'referrer']) {
    if (attr?.[key]) meta[key] = String(attr[key]).slice(0, 120);
  }
  return meta;
}
const validEmail = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Price and name come from the server: anything else in the body is ignored
  const { resultId, email, product, planId, attribution } = req.body || {};
  const source = attributionMetadata(attribution);
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';

  try {
    let session;

    if (product === 'plan') {
      // Ready-made plan purchase
      const plan = Object.hasOwn(PLAN_CONTENT, planId) ? PLAN_CONTENT[planId] : null;
      if (!plan) return res.status(400).json({ error: 'Unknown plan' });
      if (!validEmail(email)) return res.status(400).json({ error: 'A valid email is required to deliver your plan' });
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        locale: 'en',
        line_items: [{ price_data: { currency: 'eur', product_data: { name: plan.name, description: 'Complete 90-day business launch plan — delivered by email after purchase' }, unit_amount: READY_MADE_PLAN_PRICE_CENTS }, quantity: 1 }],
        mode: 'payment',
        metadata: { ...source, planId: planId || '', email: email || '', type: 'ready-made-plan' },
        customer_email: email || undefined,
        success_url: `${baseUrl}/plans?purchased=${planId}&email=${encodeURIComponent(email || '')}`,
        cancel_url: `${baseUrl}/plans`,
      });
    } else {
      // Every other product belongs to a generated plan, and is delivered through it
      if (!resultId) return res.status(400).json({ error: 'Your plan was not saved. Please retake the quiz.' });
      const { data: row } = await getSupabase().from('results').select('paid').eq('id', resultId).maybeSingle();
      if (!row) return res.status(400).json({ error: 'Your plan was not found. Please retake the quiz.' });

      if (product === 'upsell') {
        if (!row.paid) return res.status(400).json({ error: 'Unlock your plan first' });
        // €27 30-Day Launch Coach upsell
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          locale: 'en',
          line_items: [{ price_data: { currency: 'eur', product_data: { name: '30-Day Launch Coach', description: '30 daily emails personalized to your business: one task, one copy-paste script and one win to aim for each day' }, unit_amount: 2700 }, quantity: 1 }],
          mode: 'payment',
          metadata: { ...source, resultId: resultId || '', email: email || '', type: 'upsell' },
          customer_email: email || undefined,
          success_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}&upsell=1`,
          cancel_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`,
        });
      } else {
        // Don't charge twice: send an existing customer straight to the plan
        if (row.paid) return res.json({ url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}` });
        // €17 main plan
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          locale: 'en',
          line_items: [{ price_data: { currency: 'eur', product_data: { name: 'Full Business Plan · 90-day roadmap', description: 'First client strategy + pricing + tools + day-by-day action plan + mistakes to avoid' }, unit_amount: 1700 }, quantity: 1 }],
          mode: 'payment',
          metadata: { ...source, resultId: resultId || '', email: email || '' },
          customer_email: email || undefined,
          success_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`,
          cancel_url: `${baseUrl}/quiz.html?rid=${resultId}`,
        });
      }
    }

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
