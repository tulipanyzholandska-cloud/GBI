import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
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
