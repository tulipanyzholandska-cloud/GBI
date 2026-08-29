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
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
        created_at: row.created_at,
        magic_link: row.paid
          ? `https://getbizidea.com/quiz.html?unlocked=true&rid=${row.id}`
          : `https://getbizidea.com/quiz.html?rid=${row.id}`
      };
    });

    const paid        = orders.filter(o => o.paid);
    const upsells     = orders.filter(o => o.upsell_paid);
    const with_email  = orders.filter(o => o.email && o.email !== '—');
    const revenue_eur = (paid.length * 7) + (upsells.length * 27);
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
        if (o.paid) { dayMap[key].paid++; dayMap[key].revenue += 7; }
        if (o.upsell_paid) { dayMap[key].revenue += 27; }
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

    res.json({
      orders,
      stats: {
        total: orders.length,
        paid: paid.length,
        upsells: upsells.length,
        with_email: with_email.length,
        revenue_eur,
        conv_rate,
        email_rate,
      },
      by_day,
      top_ideas,
    });
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,3).join(' | ') });
  }
}
