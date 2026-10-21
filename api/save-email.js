import { getSupabase } from './_supabase.js';
import { brevoSend, rememberScheduled } from './_send-email.js';

const SENDER = { name: 'Get Biz Idea 🚀', email: 'hello@getbizidea.com' };

const emailWrap = (body, unsubLink) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0">Get Biz Idea</h1>
  </div>
  ${body}
  <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:24px 0 0">
    Get Biz Idea · getbizidea.com<br>
    You received this because you requested a free business plan preview.<br>
    <a href="${unsubLink}" style="color:rgba(255,255,255,0.2);text-decoration:underline">Unsubscribe</a>
  </p>
</body></html>`;

async function scheduleReminders(supabase, email, resultId, ideaName, baseUrl) {
  const link = `${baseUrl}/quiz.html?rid=${resultId}`;
  const unsubLink = `${baseUrl}/api/unsubscribe?${resultId ? `rid=${resultId}&` : ''}email=${encodeURIComponent(email)}`;

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
        </div>`, unsubLink)
    },
    {
      // 70h, not 72h: stays inside Brevo's scheduling window
      delay: 70,
      subject: `Still thinking about ${ideaName || 'your business idea'}?`,
      html: emailWrap(`
        <div style="background:linear-gradient(135deg,rgba(232,65,122,0.18),rgba(124,58,237,0.12));border:1px solid rgba(232,65,122,0.35);border-radius:16px;padding:28px;margin-bottom:16px">
          <h2 style="font-size:22px;font-weight:800;margin:0 0 12px;line-height:1.3">Your plan is saved — whenever you're ready</h2>
          <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 20px">
            A few days ago you matched with <strong style="color:#fff">${ideaName || 'a business idea'}</strong>. Your results are saved, so you can pick up right where you left off.
          </p>
          <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:20px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.8">
            The full plan includes the exact outreach script, pricing, and 90-day roadmap — everything you need to land your first client.
          </div>
          <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 20px">
            Not sure it's for you? Just reply to this email — tell me what's holding you back and I'll answer personally.
          </p>
          <div style="text-align:center">
            <a href="${link}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e8417a,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none">Get my plan now →</a>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px">€17 one-time · Instant access</div>
          </div>
        </div>`, unsubLink)
    }
  ];

  const now = Date.now();
  const sent = await Promise.all(reminders.map(r => brevoSend({
    sender: SENDER,
    to: [{ email }],
    subject: r.subject,
    htmlContent: r.html,
    scheduledAt: new Date(now + r.delay * 60 * 60 * 1000).toISOString(),
    tags: ['gbi-reminder', `reminder-${r.delay}h`]
  }, `reminder ${r.delay}h`)));
  await rememberScheduled(supabase, resultId, sent.map(r => r.messageId));
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
    const supabase = getSupabase();

    if (resultId) {
      const { data } = await supabase.from('results').select('email, paid, quiz_data').eq('id', resultId).single();
      // Don't send reminders to paying customers
      if (data?.paid) return res.json({ ok: true, skipped: 'already paid' });
      if (data?.quiz_data?.unsubscribed) return res.json({ ok: true, skipped: 'unsubscribed' });
      // Don't schedule reminders again if email already saved (dedup)
      if (data?.email) {
        await supabase.from('results').update({ email }).eq('id', resultId);
        return res.json({ ok: true, skipped: 'already scheduled' });
      }
      await supabase.from('results').update({ email }).eq('id', resultId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';

    // Schedule 24h + 72h reminders (awaited: Vercel freezes the function after the response)
    await scheduleReminders(supabase, email, resultId, ideaName, baseUrl);

    res.json({ ok: true });
  } catch (err) {
    console.error('Save email error:', err);
    res.status(500).json({ error: err.message });
  }
}
