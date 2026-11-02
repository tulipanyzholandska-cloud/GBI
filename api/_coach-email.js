// One day of the 30-Day Launch Coach (sent by api/send-scheduled.js)
export function buildCoachEmail(dayData, ideaName, email, resultId, baseUrl) {
  const magicLink = `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}&upsell=1`;
  return {
    subject: `Day ${dayData.day}: ${dayData.theme || 'Your daily task'}`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
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
  <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center">Get Biz Idea · Day ${dayData.day} of 30 · <a href="${baseUrl}/api/unsubscribe?rid=${resultId}&email=${encodeURIComponent(email)}" style="color:rgba(255,255,255,0.2)">Unsubscribe</a></p>
</body></html>`
  };
}
