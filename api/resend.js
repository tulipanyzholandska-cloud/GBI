import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './send-email.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Find most recent paid result for this email
    const { data, error } = await supabase
      .from('results')
      .select('id, plan, paid, created_at')
      .eq('email', email.toLowerCase().trim())
      .eq('paid', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Don't reveal if email exists or not — security best practice
      return res.json({ ok: true, message: 'If this email has a paid plan, you will receive it shortly.' });
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';
    const magicLink = `${baseUrl}/quiz.html?unlocked=true&rid=${data.id}`;
    const businessName = data.plan?.top_idea?.name || 'your business plan';

    await sendEmail({
      to: email,
      subject: 'Here is your Get Biz Idea link 🔗',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:12px">
          <h2 style="font-size:20px;font-weight:800;margin:0 0 8px">Your link is here</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:15px;margin:0 0 28px">Here's your access link for <strong style="color:#fff">${businessName}</strong>:</p>
          <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:#E8417A;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px">Open my plan →</a>
          <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:24px 0 0">This link is permanent — bookmark it so you always have access.<br>Questions? Reply to this email.</p>
        </div>
      `
    });

    res.json({ ok: true, message: 'If this email has a paid plan, you will receive it shortly.' });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
}
