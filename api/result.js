import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('results').select('id, plan, paid, language').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json({ plan: data.plan, paid: data.paid, language: data.language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
