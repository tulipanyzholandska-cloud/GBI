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
    const { data, error } = await supabase.from('results').select('plan, email, quiz_data, paid').eq('id', rid).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    // Only return full plan if paid; otherwise just basic preview
    const isPaid = data.paid === true;
    // Gate premium content — strip full_plan and blocks for unpaid users
    let plan = data.plan;
    if (!isPaid && plan) {
      const { full_plan, blocks, ...freePlan } = plan;
      plan = freePlan;
    }
    res.json({ plan, email: data.email, quiz_data: data.quiz_data, paid: isPaid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
