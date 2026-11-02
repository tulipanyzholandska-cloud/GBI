import { db } from './_supabase.js';
import { toFreePlan } from './_plan-access.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { rid } = req.query;
  if (!rid) return res.status(400).json({ error: 'Missing rid' });

  try {
    const { data, error } = await db().from('results').select('plan, email, quiz_data, paid, is_test').eq('id', rid).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    // Only return full plan if paid; otherwise just the free preview
    const isPaid = data.paid === true;
    const plan = isPaid ? data.plan : toFreePlan(data.plan);
    res.json({ plan, email: data.email, quiz_data: data.quiz_data, paid: isPaid, is_test: data.is_test || false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
