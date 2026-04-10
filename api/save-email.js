import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { resultId, email, ideaName } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    if (resultId) {
      await supabase.from('results').update({ email }).eq('id', resultId);
    }

    // Pošli welcome email
    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ideaName, resultId })
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Save email error:', err);
    res.status(500).json({ error: err.message });
  }
}
