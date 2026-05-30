import { createClient } from '@supabase/supabase-js';

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

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // Try with is_test column; fall back gracefully if column not yet added in Supabase
    let data, error;
    const r1 = await supabase
      .from('results')
      .select('id, email, paid, is_test, created_at, quiz_data, plan')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (r1.error && r1.error.message?.includes('is_test')) {
      // Column doesn't exist yet — fetch without it (no test filtering until column is added)
      const r2 = await supabase
        .from('results')
        .select('id, email, paid, created_at, quiz_data, plan')
        .order('created_at', { ascending: false })
        .limit(1000);
      data = r2.data; error = r2.error;
    } else {
      data = r1.data; error = r1.error;
    }

    if (error) throw error;
    // Exclude test orders (PIN 2810) — is_test=undefined when column missing → filter is no-op
    const rows = (data || []).filter(r => !r.is_test);

    // ── Orders table ─────────────────────────────────────────────
    const orders = rows.map(row => ({
      id: row.id,
      email: row.email || '—',
      paid: row.paid || false,
      business: row.plan?.top_idea?.name || '—',
      location: row.quiz_data?.location || '—',
      created_at: row.created_at,
      magic_link: row.paid
        ? `https://getbizidea.com/quiz.html?unlocked=true&rid=${row.id}`
        : `https://getbizidea.com/quiz.html?rid=${row.id}`
    }));

    const paid = rows.filter(r => r.paid);
    const withEmail = rows.filter(r => r.email);

    // ── Stats ────────────────────────────────────────────────────
    const revenue = paid.length * 7;
    const convRate = rows.length ? +((paid.length / rows.length) * 100).toFixed(1) : 0;
    const emailRate = rows.length ? +((withEmail.length / rows.length) * 100).toFixed(1) : 0;

    // ── By day (last 30 days) ────────────────────────────────────
    const byDayMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDayMap[key] = { date: key, total: 0, paid: 0, revenue: 0 };
    }
    rows.forEach(r => {
      const key = (r.created_at || '').slice(0, 10);
      if (byDayMap[key]) {
        byDayMap[key].total++;
        if (r.paid) { byDayMap[key].paid++; byDayMap[key].revenue += 7; }
      }
    });
    const byDay = Object.values(byDayMap);

    // ── By week (last 8 weeks) ───────────────────────────────────
    const byWeekMap = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const y = d.getFullYear();
      const w = getISOWeek(d);
      const key = `${y}-W${String(w).padStart(2, '0')}`;
      byWeekMap[key] = { week: key, total: 0, paid: 0, revenue: 0 };
    }
    rows.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, '0')}`;
      if (byWeekMap[key]) {
        byWeekMap[key].total++;
        if (r.paid) { byWeekMap[key].paid++; byWeekMap[key].revenue += 7; }
      }
    });
    const byWeek = Object.values(byWeekMap);

    // ── By country ───────────────────────────────────────────────
    const cc = {};
    rows.forEach(r => {
      const loc = r.quiz_data?.location || 'Unknown';
      cc[loc] = (cc[loc] || 0) + 1;
    });
    const byCountry = Object.entries(cc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    // ── Top ideas (paid) ─────────────────────────────────────────
    const ic = {};
    paid.forEach(r => {
      const idea = r.plan?.top_idea?.name || 'Unknown';
      ic[idea] = (ic[idea] || 0) + 1;
    });
    const topIdeas = Object.entries(ic)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));

    // ── Funnel ───────────────────────────────────────────────────
    const funnel = [
      { label: 'Quiz dokončen', count: rows.length, pct: 100 },
      { label: 'E-mail zadán', count: withEmail.length, pct: rows.length ? +((withEmail.length / rows.length) * 100).toFixed(1) : 0 },
      { label: 'Zaplaceno', count: paid.length, pct: rows.length ? +((paid.length / rows.length) * 100).toFixed(1) : 0 },
    ];

    // ── Age / hours breakdown (from quiz_data) ───────────────────
    const ageCounts = {};
    rows.forEach(r => {
      const age = r.quiz_data?.age || 'Unknown';
      ageCounts[age] = (ageCounts[age] || 0) + 1;
    });
    const byAge = Object.entries(ageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

    res.json({
      orders,
      stats: {
        total: rows.length,
        with_email: withEmail.length,
        paid: paid.length,
        revenue_eur: revenue,
        conv_rate: convRate,
        email_rate: emailRate,
      },
      funnel,
      by_day: byDay,
      by_week: byWeek,
      by_country: byCountry,
      top_ideas: topIdeas,
      by_age: byAge,
    });

  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ error: err.message });
  }
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
