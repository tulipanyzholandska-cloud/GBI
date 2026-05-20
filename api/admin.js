import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  // Simple token auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('results')
      .select('id, email, paid, created_at, quiz_data, plan')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const orders = (data || []).map(row => ({
      id: row.id,
      email: row.email || '—',
      paid: row.paid || false,
      business: row.plan?.top_idea?.name || '—',
      location: row.quiz_data?.location || '—',
      created_at: row.created_at,
      magic_link: row.paid ? `https://getbizidea.com/quiz.html?unlocked=true&rid=${row.id}` : `https://getbizidea.com/quiz.html?rid=${row.id}`
    }));

    const paid = orders.filter(o => o.paid);
    const revenue = paid.length * 7;

    res.json({ orders, stats: { total: orders.length, paid: paid.length, revenue_eur: revenue } });
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ error: err.message });
  }
}
