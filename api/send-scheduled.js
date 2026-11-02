import { getSupabase } from './_supabase.js';
import { brevoSend } from './_send-email.js';
import { SEQUENCE, buildDripEmail } from './_drip-emails.js';
import { buildCoachEmail } from './_coach-email.js';

const SENDER_EMAIL = 'hello@getbizidea.com';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TIME_BUDGET_MS = 50 * 1000;
// Two Vercel projects deploy this repo and share one DB: only the live one may send
const LIVE_PROJECT_ID = 'prj_dYlMeaBXRen5A6OnWtCQl4gwD8kN';

const calendarDaysSince = (iso, now) =>
  Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY) -
  Math.floor(new Date(iso).setUTCHours(0, 0, 0, 0) / MS_PER_DAY);

// At most one email per sequence per run, so a missed cron can't flood anyone
const nextDue = (steps, sent, elapsed) =>
  steps
    .filter(step => step.day <= elapsed && !sent.includes(step.day))
    .sort((a, b) => a.day - b.day)[0];

// Daily cron: Brevo schedules at most 72 hours ahead, so the drip and the 30-day coach go out from here
export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID !== LIVE_PROJECT_ID) {
    return res.json({ ok: true, skipped: 'not the live project' });
  }

  const started = Date.now();
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';
  const now = new Date();
  const counts = { drip: 0, coach: 0, failed: 0 };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('results')
      .select('id, email, plan, quiz_data, is_test')
      .eq('paid', true);
    if (error) throw error;

    for (const row of data || []) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const plan = row.plan || {};
      if (!row.email || row.is_test || row.quiz_data?.unsubscribed) continue;

      const updates = {};

      if (plan.paid_at) {
        const sent = plan.drip_sent || [];
        const step = nextDue(SEQUENCE, sent, calendarDaysSince(plan.paid_at, now));
        if (step) {
          const { subject, html } = buildDripEmail(step, row.email, row.id, baseUrl);
          const result = await brevoSend({
            sender: { name: 'Get Biz Idea 🚀', email: SENDER_EMAIL },
            to: [{ email: row.email }],
            subject,
            htmlContent: html,
            tags: ['gbi-drip', `day-${step.day}`]
          }, `drip day ${step.day}`);
          if (result.ok) { updates.drip_sent = [...sent, step.day]; counts.drip++; } else counts.failed++;
        }
      }

      if (plan.coach_started_at && plan.blocks?.[5]?.days?.length) {
        const sent = plan.coach_sent || [];
        const dayData = nextDue(plan.blocks[5].days.slice(0, 30), sent, calendarDaysSince(plan.coach_started_at, now));
        if (dayData) {
          const { subject, html } = buildCoachEmail(dayData, plan.top_idea?.name || 'your business', row.email, row.id, baseUrl);
          const result = await brevoSend({
            sender: { name: 'Get Biz Idea Coach', email: SENDER_EMAIL },
            to: [{ email: row.email }],
            subject,
            htmlContent: html,
            tags: ['gbi-coach', `coach-day-${dayData.day}`]
          }, `coach day ${dayData.day}`);
          if (result.ok) { updates.coach_sent = [...sent, dayData.day]; counts.coach++; } else counts.failed++;
        }
      }

      if (Object.keys(updates).length) {
        // Unsent days stay unmarked, so they go out on the next run
        await supabase.from('results').update({ plan: { ...plan, ...updates } }).eq('id', row.id);
      }
    }

    console.log('Scheduled emails:', JSON.stringify(counts));
    res.json({ ok: true, ...counts });
  } catch (err) {
    console.error('Scheduled emails error:', err.message);
    res.status(500).json({ error: 'Scheduled send failed' });
  }
}
