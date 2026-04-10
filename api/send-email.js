export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, ideaName, resultId } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#fff">
  <div style="text-align:center;margin-bottom:30px">
    <h1 style="color:#e8417a;font-size:28px;margin:0">Get Biz Idea</h1>
    <p style="color:rgba(255,255,255,0.6);margin:8px 0 0">Your AI Business Matchmaker</p>
  </div>
  
  <div style="background:linear-gradient(135deg,rgba(120,60,180,0.3),rgba(232,65,122,0.2));border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:28px;margin-bottom:24px">
    <h2 style="color:#fff;margin:0 0 12px">Your business idea is ready!</h2>
    <p style="color:rgba(255,255,255,0.8);line-height:1.7;margin:0 0 16px">
      We've saved your personalized business idea: <strong style="color:#e8417a">${ideaName || 'Your AI Business Plan'}</strong>
    </p>
    <p style="color:rgba(255,255,255,0.8);line-height:1.7;margin:0 0 24px">
      Your result includes a full income forecast and 3 business ideas matched to your profile. Unlock the complete 90-day action plan to start building today.
    </p>
    <div style="text-align:center">
      <a href="https://app.getbizidea.com/?rid=${resultId}" 
         style="background:#e8417a;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
        View My Business Plan →
      </a>
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:24px">
    <h3 style="color:#a78bfa;margin:0 0 12px;font-size:16px">What's included in the full plan:</h3>
    <ul style="color:rgba(255,255,255,0.8);line-height:1.9;margin:0;padding-left:20px">
      <li>90-day action plan (days 1–7, 8–30, 31–90)</li>
      <li>How to get your first paying customer</li>
      <li>Pricing strategy & when to raise prices</li>
      <li>Tools you'll need (with costs)</li>
      <li>Top mistakes to avoid</li>
    </ul>
    <div style="text-align:center;margin-top:20px">
      <a href="https://app.getbizidea.com/?rid=${resultId}" 
         style="background:rgba(124,58,237,0.3);color:#a78bfa;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;border:1px solid rgba(124,58,237,0.5)">
        Unlock Full Plan · 19 €
      </a>
    </div>
  </div>

  <p style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;margin:0">
    Get Biz Idea · app.getbizidea.com<br>
    You received this because you saved your result on our platform.
  </p>
</body>
</html>`;

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Get Biz Idea', email: 'hello@getbizidea.com' },
        to: [{ email }],
        subject: `Your business idea is ready: ${ideaName || 'AI Business Plan'}`,
        htmlContent
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: err.message });
  }
}
