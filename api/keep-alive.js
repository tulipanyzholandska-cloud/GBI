import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('results')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    console.log('Keep-alive ping OK, rows:', count);
    res.json({ ok: true, rows: count, ts: new Date().toISOString() });
  } catch (err) {
    console.error('Keep-alive error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
