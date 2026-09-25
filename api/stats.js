import { createClient } from '@supabase/supabase-js';

// Public, real social-proof numbers for the landing page and quiz.
// Only counts — no personal data. Cached at the edge for 1 hour.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const notTest = 'is_test.is.null,is_test.eq.false';
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [total, week] = await Promise.all([
      supabase.from('results').select('id', { count: 'exact', head: true }).or(notTest),
      supabase.from('results').select('id', { count: 'exact', head: true }).or(notTest).gte('created_at', weekAgo),
    ]);
    if (total.error) throw total.error;
    if (week.error) throw week.error;

    res.json({ plans_total: total.count || 0, plans_week: week.count || 0 });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'stats unavailable' });
  }
}
