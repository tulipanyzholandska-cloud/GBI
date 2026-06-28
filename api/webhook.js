import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { scheduleDripEmails } from './_drip-emails.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  let raw;

  try {
    raw = await getRawBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to read body' });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    body = {};
  }

  if (body.testMode === true) {
    event = body;
  } else {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const resultId = session.metadata?.resultId;
    const email = session.customer_email || session.metadata?.email;
    const type = session.metadata?.type;

    // ── UPSELL PAYMENT (€27 Launch Week) ──────────────────────────────────────
    if (type === 'upsell') {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';

        if (resultId) {
          const { data: row } = await supabase.from('results').select('plan').eq('id', resultId).single();
          if (row && !row.plan?.upsell_paid) {
            const updatedPlan = { ...row.plan, upsell_paid: true };
            await supabase.from('results').update({ plan: updatedPlan }).eq('id', resultId);
          }
        }

        // Fire-and-forget: generate 30-day plan + schedule daily emails
        if (email && resultId) {
          generateAndScheduleCoach(email, resultId, row?.plan, baseUrl)
            .catch(e => console.error('Coach schedule error:', e.message));
        }

        if (email && resultId) {
          const magicLink = `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}&upsell=1`;
          const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0">Get Biz Idea</h1>
    <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:14px">Your Launch Week is ready</p>
  </div>
  <div style="background:linear-gradient(135deg,rgba(232,65,122,0.2),rgba(124,58,237,0.15));border:1px solid rgba(232,65,122,0.3);border-radius:16px;padding:28px;margin-bottom:24px;text-align:center">
    <div style="font-size:32px;margin-bottom:12px">🚀</div>
    <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 10px">Your Launch Week plan is ready!</h2>
    <p style="color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;margin:0 0 24px">
      Your personalized 7-day schedule is generating now. Click below to see your day-by-day launch plan.
    </p>
    <a href="${magicLink}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e8417a,#7c3aed);color:#fff;font-size:16px;font-weight:700;text-decoration:none">
      Open My Launch Week →
    </a>
  </div>
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px">
    <h3 style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em;margin:0 0 14px">What's in your Launch Week</h3>
    <div style="font-size:14px;color:rgba(255,255,255,0.8);line-height:2.2">
      ✦ &nbsp;Day-by-day schedule — morning, afternoon, evening tasks<br>
      ✦ &nbsp;Daily script — exact words to use each day<br>
      ✦ &nbsp;Daily win — know when you've crushed it<br>
      ✦ &nbsp;Week 1 milestone: your first paid client
    </div>
  </div>
  <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0">
    Get Biz Idea · getbizidea.com<br>
    You received this because you purchased Launch Week.
  </p>
</body></html>`;
          fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: { name: 'Get Biz Idea 🚀', email: 'hello@getbizidea.com' },
              to: [{ email }],
              subject: '🚀 Your Launch Week plan is generating now',
              htmlContent
            })
          }).catch(e => console.error('Upsell email error:', e.message));
        }
      } catch (err) {
        console.error('Upsell webhook error:', err.message);
      }
      return res.json({ received: true });
    }

    // ── MAIN PLAN PAYMENT (€7) ─────────────────────────────────────────────────
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

      // IDEMPOTENCY: check if already paid (don't re-send emails on repeated unlocks)
      let alreadyPaid = false;
      if (resultId) {
        // Atomic update: only succeeds if paid is currently false — prevents race condition with Stripe retries
        const isTest = body.testMode === true;
        const { data: updated } = await supabase
          .from('results')
          .update({ paid: true, email, ...(isTest ? { is_test: true } : {}) })
          .eq('id', resultId)
          .eq('paid', false)
          .select('id')
          .single();
        alreadyPaid = !updated;
      }

      if (alreadyPaid) {
        console.log('Skipping emails — already paid for rid:', resultId);
        return res.json({ received: true, alreadyPaid: true });
      }

      if (email && resultId) {
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';
        const magicLink = `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`;

        const subject = type === 'tripwire'
          ? 'Your 30-Day Action Plan is ready'
          : 'Your full Business Plan is unlocked';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0">Get Biz Idea</h1>
    <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:14px">Your AI Business Report</p>
  </div>

  <div style="background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15));border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:28px;margin-bottom:24px;text-align:center">
    <div style="font-size:32px;margin-bottom:12px">🎉</div>
    <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 10px">Your plan is ready!</h2>
    <p style="color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;margin:0 0 24px">
      Click the button below anytime to access your full business plan. This link works forever — bookmark it or save this email.
    </p>
    <a href="${magicLink}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;font-size:16px;font-weight:700;text-decoration:none">
      Open My Business Plan →
    </a>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px">
    <h3 style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em;margin:0 0 14px">What's inside your plan</h3>
    <div style="font-size:14px;color:rgba(255,255,255,0.8);line-height:2.2">
      ✦ &nbsp;Exact message to send your first client<br>
      ✦ &nbsp;Days 1–7: what to do starting tomorrow<br>
      ✦ &nbsp;Days 8–30: how to get 5 paying clients<br>
      ✦ &nbsp;Days 31–90: path to stable monthly income<br>
      ✦ &nbsp;Pricing strategy for your market<br>
      ✦ &nbsp;Tools you need + exact costs
    </div>
  </div>

  <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;margin-bottom:24px">
    <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0;line-height:1.6">
      💾 &nbsp;<strong style="color:#fff">Save this email</strong> — your magic link is inside. No account needed, just click the button above anytime to return to your plan.
    </p>
  </div>

  <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0">
    Get Biz Idea · app.getbizidea.com<br>
    You received this because you purchased a plan on our platform.
  </p>
</body>
</html>`;

        // FIRE-AND-FORGET welcome email + drip (don't block webhook response)
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'Get Biz Idea 🚀', email: 'hello@getbizidea.com' },
            to: [{ email }],
            subject,
            htmlContent
          })
        }).catch(e => console.error('Welcome email bg error:', e.message));

        // Fire-and-forget 7-email drip sequence
        if (type !== 'tripwire') {
          scheduleDripEmails(email, resultId, baseUrl)
            .then(drip => console.log('Drip scheduled:', JSON.stringify(drip)))
            .catch(dripErr => console.error('Drip schedule error:', dripErr.message));
        }
      }
    } catch (err) {
      console.error('Post-payment error:', err.message);
    }
  }

  res.json({ received: true });
}

async function generateAndScheduleCoach(email, resultId, plan, baseUrl) {
  // Generate 30-day plan using Claude (block 5)
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const ideaName = plan?.top_idea?.name || 'your business';
  const quizData = plan?.quiz_data || {};
  const ctx = `Business: "${ideaName}", age ${quizData.age||''}, location ${quizData.location||''}, ${quizData.time||''}/week, budget ${quizData.budget||''}, strengths: ${quizData.strengths||''}, interests: ${quizData.interests||''}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: 'Premium business coach. ALL output in English. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: `${ctx}\n\nCreate a 30-day daily coaching plan. Each day: task, copy-paste script, win metric.\nReturn JSON: {"days":[{"day":1,"theme":"","task":"","script":"","win":"","time_minutes":45},...30 days total]}` }]
  });

  const textBlock = msg.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text block from Claude');
  const raw = textBlock.text.replace(/```json|```/g, '').trim();

  // Extract JSON safely
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in response');
  const coachPlan = JSON.parse(raw.slice(start, end + 1));
  const days = coachPlan.days || [];

  // Save to DB
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: row } = await supabase.from('results').select('plan').eq('id', resultId).single();
  if (row) {
    const updatedPlan = { ...row.plan, blocks: { ...(row.plan?.blocks || {}), 5: coachPlan } };
    await supabase.from('results').update({ plan: updatedPlan }).eq('id', resultId);
  }

  // Schedule 30 daily emails via Brevo (fire sequentially, don't await)
  const magicLink = `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}&upsell=1`;
  const now = new Date();

  for (const dayData of days.slice(0, 30)) {
    const sendAt = new Date(now);
    sendAt.setDate(sendAt.getDate() + (dayData.day - 1));
    sendAt.setHours(8, 0, 0, 0); // 8am each day

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;padding:16px 0 24px">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.4)">Day ${dayData.day} · ${ideaName}</span>
  </div>
  <div style="background:linear-gradient(135deg,rgba(232,65,122,0.15),rgba(124,58,237,0.1));border:1px solid rgba(232,65,122,0.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#e8417a;margin-bottom:8px">TODAY'S THEME</div>
    <div style="font-size:20px;font-weight:800;margin-bottom:4px">${dayData.theme || ''}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.4)">${dayData.time_minutes || 30} minutes</div>
  </div>
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.4);margin-bottom:10px">TODAY'S TASK</div>
    <div style="font-size:15px;font-weight:600;line-height:1.5">${dayData.task || ''}</div>
  </div>
  ${dayData.script ? `<div style="background:rgba(124,58,237,0.1);border-left:4px solid #7c3aed;border-radius:0 12px 12px 0;padding:16px 18px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a78bfa;margin-bottom:8px">COPY-PASTE SCRIPT</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);line-height:1.7;font-style:italic">${dayData.script}</div>
  </div>` : ''}
  <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:14px 16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5dcaa5;margin-bottom:6px">🎯 TODAY'S WIN</div>
    <div style="font-size:14px;font-weight:600">${dayData.win || ''}</div>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <a href="${magicLink}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:rgba(124,58,237,0.3);border:1px solid #7c3aed;color:#fff;font-size:14px;font-weight:700;text-decoration:none">Open My Business Plan →</a>
  </div>
  <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center">Get Biz Idea · Day ${dayData.day} of 30 · <a href="${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}" style="color:rgba(255,255,255,0.2)">Unsubscribe</a></p>
</body></html>`;

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Get Biz Idea Coach', email: 'hello@getbizidea.com' },
        to: [{ email }],
        subject: `Day ${dayData.day}: ${dayData.theme || 'Your daily task'}`,
        htmlContent: html,
        scheduledAt: sendAt.toISOString()
      })
    });
  }
  console.log(`Coach: scheduled ${days.length} emails for ${email}`);
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
