// Drip email sequence — scheduled after unlock to drive engagement & retention
// Uses Brevo's scheduledAt parameter

const SENDER = { name: 'Get Biz Idea 🚀', email: 'hello@getbizidea.com' };

const wrap = (title, body, magicLink) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;letter-spacing:-.01em">Get Biz Idea</h1>
  </div>
  <div style="background:linear-gradient(135deg,rgba(124,58,237,0.18),rgba(232,65,122,0.10));border:1px solid rgba(167,139,250,0.3);border-radius:16px;padding:28px;margin-bottom:18px">
    <h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.25;letter-spacing:-.01em">${title}</h2>
    <div style="color:rgba(255,255,255,0.78);font-size:15px;line-height:1.7">${body}</div>
    <div style="text-align:center;margin-top:22px">
      <a href="${magicLink}" style="display:inline-block;padding:13px 28px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#e8417a);color:#fff;font-size:15px;font-weight:700;text-decoration:none">Open my plan →</a>
    </div>
  </div>
  <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:14px 0 0">
    Get Biz Idea · app.getbizidea.com<br>
    You can reply to this email — we read every reply.
  </p>
</body></html>`;

const SEQUENCE = [
  { day: 1, subject: '✓ Day 1 — Your first action today',
    title: 'Day 1: Start with your first move',
    body: `<p>You unlocked your full 90-day plan. Today the only thing that matters is taking your <strong>first concrete action</strong>.</p>
    <p>👉 Open your plan and complete the first item from <strong>Days 1–7</strong>. Just one. Five minutes.</p>
    <p>Most people who get the plan never start. The ones who do, win.</p>` },
  { day: 3, subject: '🔥 How is your outreach going?',
    title: 'Day 3 check-in',
    body: `<p>By now you should have done your <strong>first outreach</strong>.</p>
    <p>Quick check:</p>
    <ul style="padding-left:20px;line-height:1.9"><li>Have you contacted at least 10 prospects?</li><li>Did you use the exact script from your plan?</li><li>Any replies yet?</li></ul>
    <p>If not — that's okay. Block 30 minutes today and do 10 messages. Use the copy-paste script in your plan.</p>` },
  { day: 7, subject: '🎯 Week 1 milestone — how did it go?',
    title: 'Week 1 complete',
    body: `<p>One week down. By now you should have:</p>
    <ul style="padding-left:20px;line-height:1.9"><li>Set up your profile/website</li><li>Sent 50+ outreach messages</li><li>Had 1–3 conversations</li></ul>
    <p>If you've hit those — you're on the optimistic track. If not — adjust and keep going.</p>
    <p>This week we move to <strong>Days 8–30: Getting your first 5 paying clients</strong>. Open your plan and check the next steps.</p>` },
  { day: 14, subject: '💬 Mid-month — first client conversations?',
    title: 'Day 14 — the hard part',
    body: `<p>Day 14 is the make-or-break point. Most people quit here.</p>
    <p>If you have <strong>at least one real conversation</strong> with a potential client — you're ahead of 90% of people who buy plans like this.</p>
    <p>If you don't yet — review the <strong>"3 mistakes that kill beginners"</strong> section in your plan. One of them is probably what's holding you back.</p>` },
  { day: 30, subject: '🏆 Month 1 — review + Days 31–90',
    title: 'Month 1 done',
    body: `<p>30 days in. Time for an honest review:</p>
    <ul style="padding-left:20px;line-height:1.9"><li>How many paying clients do you have?</li><li>What's your monthly revenue right now?</li><li>What is the ONE thing blocking growth?</li></ul>
    <p>Now open <strong>Days 31–90: Stable monthly income</strong>. Different game starts now — repeat what works, drop what doesn't, raise prices.</p>` },
  { day: 60, subject: '💰 Are you at €500+/month yet?',
    title: 'Day 60 milestone',
    body: `<p>Two months in. Most successful members hit <strong>€500–€1,500/month</strong> by now.</p>
    <p>If you're there — congrats. Time to optimize: which client type is most profitable? Double down.</p>
    <p>If you're not — open your plan and look at <strong>Pricing strategy</strong>. The number one reason people stay stuck is they undercharge.</p>` },
  { day: 90, subject: '🎉 90-Day plan complete — what now?',
    title: 'You did 90 days',
    body: `<p>You've reached the end of your initial 90-day plan. By now you should know:</p>
    <ul style="padding-left:20px;line-height:1.9"><li>Whether this business works for you</li><li>Your real cost per client / margin</li><li>Which client type to focus on</li></ul>
    <p>Next: scale what works. Hire your first contractor. Build a passive income stream. Raise prices 40%.</p>
    <p>Reply to this email and tell us how it went — we want to hear your story 🙌</p>` }
];

export async function scheduleDripEmails(email, resultId, baseUrl) {
  if (!process.env.BREVO_API_KEY || !email) return { ok: false, error: 'missing config' };
  const magicLink = `${baseUrl}/?unlocked=true&rid=${resultId}`;
  const now = Date.now();
  const results = [];

  for (const step of SEQUENCE) {
    const scheduledAt = new Date(now + step.day * 24 * 60 * 60 * 1000).toISOString();
    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({
          sender: SENDER,
          to: [{ email }],
          subject: step.subject,
          htmlContent: wrap(step.title, step.body, magicLink),
          scheduledAt,
          tags: ['gbi-drip', `day-${step.day}`]
        })
      });
      const data = await resp.json().catch(() => ({}));
      results.push({ day: step.day, ok: resp.ok, status: resp.status, messageId: data.messageId });
    } catch (e) {
      results.push({ day: step.day, ok: false, error: e.message });
    }
  }
  return { ok: true, scheduled: results };
}
