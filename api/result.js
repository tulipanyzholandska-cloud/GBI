import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { rid } = req.query;
  if (!rid) return res.status(400).json({ error: 'Missing rid' });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('results').select('plan').eq('id', rid).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json({ plan: data.plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
