import Stripe from 'stripe';
import { getSupabase } from './_supabase.js';

const PLAN_PRICE_EUR = 17;
const COACH_PRICE_EUR = 27;

// Stripe is the one source of truth for sales: it also sees ready-made plans, which have no results row
async function stripeSales() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sessions = await stripe.checkout.sessions
    .list({ status: 'complete', limit: 100 })
    .autoPagingToArray({ limit: 1000 });
  const sales = { count: 0, revenue_eur: 0, plan: 0, coach: 0, ready_made: 0, by_source: {} };
  for (const s of sessions) {
    if (s.payment_status !== 'paid') continue;
    const type = s.metadata?.type;
    sales.count++;
    sales.revenue_eur += (s.amount_total || 0) / 100;
    if (type === 'upsell') sales.coach++;
    else if (type === 'ready-made-plan') sales.ready_made++;
    else sales.plan++;
    const source = s.metadata?.utm_source || s.metadata?.referrer || 'direct';
    sales.by_source[source] = (sales.by_source[source] || 0) + 1;
  }
  return sales;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing env vars: SUPABASE_URL=' + (process.env.SUPABASE_URL ? 'set' : 'MISSING') + ', SUPABASE_ANON_KEY=' + (process.env.SUPABASE_ANON_KEY ? 'set' : 'MISSING') });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('results')
      .select('id, email, paid, created_at, quiz_data, plan, is_test')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const allRows = data || [];
    const realRows = allRows.filter(row => !row.is_test);

    const orders = realRows.map(row => {
      const upsell = row.plan?.upsell_paid === true;
      return {
        id: row.id,
        email: row.email || '—',
        paid: row.paid || false,
        upsell_paid: upsell,
        business: row.plan?.top_idea?.name || '—',
        location: row.quiz_data?.location || '—',
        source: row.quiz_data?.attribution?.utm_source || row.quiz_data?.attribution?.referrer || 'direct',
        created_at: row.created_at,
        magic_link: row.paid
          ? `https://getbizidea.com/quiz.html?unlocked=true&rid=${row.id}`
          : `https://getbizidea.com/quiz.html?rid=${row.id}`
      };
    });

    const paid        = orders.filter(o => o.paid);
    const upsells     = orders.filter(o => o.upsell_paid);
    const with_email  = orders.filter(o => o.email && o.email !== '—');
    const revenue_eur = (paid.length * PLAN_PRICE_EUR) + (upsells.length * COACH_PRICE_EUR);
    const conv_rate   = orders.length > 0 ? +((paid.length / orders.length) * 100).toFixed(1) : 0;
    const email_rate  = orders.length > 0 ? +((with_email.length / orders.length) * 100).toFixed(1) : 0;

    // Daily breakdown (last 30 days)
    const dayMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, total: 0, paid: 0, revenue: 0 };
    }
    orders.forEach(o => {
      const key = o.created_at?.slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].total++;
        if (o.paid) { dayMap[key].paid++; dayMap[key].revenue += PLAN_PRICE_EUR; }
        if (o.upsell_paid) { dayMap[key].revenue += COACH_PRICE_EUR; }
      }
    });
    const by_day = Object.values(dayMap);

    // Top ideas
    const ideaCount = {};
    orders.forEach(o => {
      if (o.business && o.business !== '—') ideaCount[o.business] = (ideaCount[o.business] || 0) + 1;
    });
    const top_ideas = Object.entries(ideaCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    const quiz_by_source = {};
    orders.forEach(o => { quiz_by_source[o.source] = (quiz_by_source[o.source] || 0) + 1; });

    const sales = await stripeSales().catch(e => {
      console.error('Stripe sales error:', e.message);
      return null;
    });

    res.json({
      orders,
      sales,
      quiz_by_source,
      stats: {
        total: orders.length,
        paid: paid.length,
        upsells: upsells.length,
        with_email: with_email.length,
        revenue_eur: sales ? sales.revenue_eur : revenue_eur,
        conv_rate,
        email_rate,
      },
      by_day,
      top_ideas,
    });
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ error: err.message });
  }
}
