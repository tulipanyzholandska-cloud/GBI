import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { rid, email } = req.method === 'GET' ? req.query : req.body;

  if (!rid && !email) {
    return res.status(400).send('Missing parameters');
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    if (rid) {
      const { data: row } = await supabase.from('results').select('quiz_data').eq('id', rid).single();
      if (row) {
        await supabase.from('results')
          .update({ quiz_data: { ...(row.quiz_data || {}), unsubscribed: true, unsubscribed_at: new Date().toISOString() } })
          .eq('id', rid);
      }
    }

    // Return a simple confirmation page
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title>
    <style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
    .box{max-width:400px;padding:40px}.h{font-size:48px;margin-bottom:16px}.t{font-size:20px;font-weight:700;margin-bottom:8px}.s{font-size:14px;color:rgba(255,255,255,.5)}
    a{color:#e8417a}</style></head>
    <body><div class="box"><div class="h">✓</div><div class="t">You've been unsubscribed</div>
    <div class="s">You won't receive any more emails from Get Biz Idea.<br><br>
    <a href="https://getbizidea.com">Back to site</a></div></div></body></html>`);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).send('Error processing unsubscribe');
  }
}
