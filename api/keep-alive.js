import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('results')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
        res.json({ ok: true, db_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service' : 'anon', ts: new Date().toISOString() });
  } catch (err) {
    console.error('Keep-alive error:', err.message);
    res.status(500).json({ error: 'Database check failed' });
  }
}
