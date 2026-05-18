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

    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

      if (resultId) {
        await supabase.from('results').update({ paid: true, email }).eq('id', resultId);
      }

      if (email && resultId) {
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://app.getbizidea.com';
        const magicLink = `${baseUrl}/?unlocked=true&rid=${resultId}`;

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

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
