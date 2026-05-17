export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const to = req.query.to || req.body?.to;
  const from = req.query.from || 'hello@getbizidea.com';
  if (!to) return res.status(400).json({ error: 'Missing ?to=email@example.com' });

  if (!process.env.BREVO_API_KEY) {
    return res.status(500).json({ ok: false, error: 'BREVO_API_KEY missing in env' });
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Get Biz Idea 🚀', email: from },
        to: [{ email: to }],
        subject: '🧪 Test email from Get Biz Idea',
        htmlContent: `<html><body style="font-family:sans-serif;padding:20px"><h2>✅ Brevo works!</h2><p>If you see this, your Brevo integration is configured correctly.</p><p><small>Sent from: ${from}</small></p></body></html>`
      })
    });

    const body = await resp.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    return res.status(200).json({
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      sender_used: from,
      recipient: to,
      brevo_response: parsed,
      hint: !resp.ok ? `Brevo rejected the request. Common causes: sender "${from}" not verified, invalid API key, domain not authenticated.` : 'Check your inbox (and spam folder).'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
