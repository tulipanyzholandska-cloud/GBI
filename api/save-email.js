import { createClient } from '@supabase/supabase-js';

const SENDER = { name: 'Get Biz Idea 🚀', email: 'hello@getbizidea.com' };

const emailWrap = (body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0">Get Biz Idea</h1>
  </div>
  ${body}
  <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:24px 0 0">
    Get Biz Idea · app.getbizidea.com<br>
    You received this because you requested a free business plan preview.
  </p>
</body></html>`;

async function scheduleReminders(email, resultId, ideaName, baseUrl) {
  if (!process.env.BREVO_API_KEY) return;
  const link = `${baseUrl}/?rid=${resultId}`;

  const reminders = [
    {
      delay: 24,
      subject: '👀 Your business plan is still waiting',
      html: emailWrap(`
        <div style="background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(232,65,122,0.15));border:1px solid rgba(124,58,237,0.35);border-radius:16px;padding:28px;margin-bottom:16px">
          <h2 style="font-size:22px;font-weight:800;margin:0 0 12px;line-height:1.3">Your full plan is one click away 🔓</h2>
          <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 16px">
            You already got your <strong style="color:#fff">${ideaName || 'business idea'}</strong> match — the full 90-day plan with exact scripts, pricing, and daily tasks is ready for you.
          </p>
          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px">What's inside the full plan:</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.85);line-height:2">
              ✦ &nbsp;Exact message to send your first client<br>
              ✦ &nbsp;Days 1–7: what to do starting tomorrow<br>
              ✦ &nbsp;Pricing strategy + when to raise prices<br>
              ✦ &nbsp;90-day roadmap to stable income
            </div>
          </div>
          <div style="text-align:center">
            <a href="${link}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#e8417a);color:#fff;font-size:16px;font-weight:700;text-decoration:none">Unlock my full plan →</a>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px">One-time · Instant access · No subscription</div>
          </div>
        </div>`)
    },
    {
      delay: 72,
      subject: '⏳ Last reminder — your plan expires soon',
      html: emailWrap(`
        <div style="background:linear-gradient(135deg,rgba(232,65,122,0.18),rgba(124,58,237,0.12));border:1px solid rgba(232,65,122,0.35);border-radius:16px;padding:28px;margin-bottom:16px">
          <div style="display:inline-block;padding:4px 12px;border-radius:100px;background:rgba(232,65,122,0.2);font-size:11px;font-weight:700;color:#e8417a;margin-bottom:14px;letter-spacing:.06em">⏳ EXPIRES SOON</div>
          <h2 style="font-size:22px;font-weight:800;margin:0 0 12px;line-height:1.3">Don't let your plan go to waste</h2>
          <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 20px">
            3 days ago you matched with <strong style="color:#fff">${ideaName || 'a business idea'}</strong>. Every day you wait is a day someone else in your market gets ahead.
          </p>
          <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:20px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.8">
            The full plan includes the exact outreach script, pricing, and 90-day roadmap — everything you need to land your first client.
          </div>
          <div style="text-align:center">
            <a href="${link}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e8417a,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none">Get my plan now →</a>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px">€7 one-time · Instant access</div>
          </div>
        </div>`)
    }
  ];

  const now = Date.now();
  for (const r of reminders) {
    const scheduledAt = new Date(now + r.delay * 60 * 60 * 1000).toISOString();
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email }],
        subject: r.subject,
        htmlContent: r.html,
        scheduledAt,
        tags: ['gbi-reminder', `reminder-${r.delay}h`]
      })
    }).catch(e => console.error(`Reminder ${r.delay}h error:`, e.message));
  }
}

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
      // Check if already paid — don't send reminders to paying customers
      const { data } = await supabase.from('results').select('paid').eq('id', resultId).single();
      if (data?.paid) return res.json({ ok: true, skipped: 'already paid' });

      await supabase.from('results').update({ email }).eq('id', resultId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://app.getbizidea.com';

    // Schedule 24h + 72h reminders (fire-and-forget)
    scheduleReminders(email, resultId, ideaName, baseUrl);

    res.json({ ok: true });
  } catch (err) {
    console.error('Save email error:', err);
    res.status(500).json({ error: err.message });
  }
}
