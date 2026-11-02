import { db } from './_supabase.js';
import { blockContact, cancelScheduledEmail } from './_send-email.js';

const page = (title, text) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
    .box{max-width:400px;padding:40px}.t{font-size:20px;font-weight:700;margin-bottom:8px}.s{font-size:14px;color:rgba(255,255,255,.5)}
    a{color:#e8417a}</style></head>
    <body><div class="box"><div class="t">${title}</div>
    <div class="s">${text}<br><br><a href="https://getbizidea.com">Back to site</a></div></div></body></html>`;

export default async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { rid } = params;
  let email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';

  if (!rid && !email) {
    return res.status(400).send('Missing parameters');
  }

  res.setHeader('Content-Type', 'text/html');
  try {
    const supabase = db();
    const rows = [];

    if (rid) {
      const { data: row } = await supabase.from('results').select('id, email, quiz_data').eq('id', rid).single();
      if (row) {
        rows.push(row);
        email = email || (row.email || '').toLowerCase();
      }
    }
    if (email) {
      const { data } = await supabase.from('results').select('id, email, quiz_data').ilike('email', email.replace(/[\\%_]/g, '\\$&'));
      for (const row of data || []) if (!rows.some(r => r.id === row.id)) rows.push(row);
    }

    // Scheduled sends live at Brevo, so blocking the address there is what actually stops them
    if (email) await blockContact(email);

    const now = new Date().toISOString();
    for (const row of rows) {
      await Promise.all((row.quiz_data?.reminder_message_ids || []).map(id =>
        cancelScheduledEmail(id).catch(e => console.error('Cancel reminder error:', e.message))
      ));
      await supabase.from('results')
        .update({ quiz_data: { ...(row.quiz_data || {}), unsubscribed: true, unsubscribed_at: now, reminder_message_ids: [] } })
        .eq('id', row.id);
    }

    res.send(page("You've been unsubscribed", "You won't receive any more emails from Get Biz Idea."));
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).send(page('We could not unsubscribe you', 'Please try again, or email hello@getbizidea.com and we will remove you by hand.'));
  }
}
