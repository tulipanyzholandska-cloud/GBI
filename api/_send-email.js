const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Send (or schedule, via payload.scheduledAt) one transactional email through Brevo.
// Never throws: Brevo errors are logged with status + body so failures show up in
// Vercel logs instead of disappearing. Returns { ok, status, messageId }.
export async function brevoSend(payload, label = 'email') {
  if (!process.env.BREVO_API_KEY) {
    console.error(`Brevo ${label}: BREVO_API_KEY missing`);
    return { ok: false, status: 0 };
  }
  try {
    const resp = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) { /* non-JSON body */ }
    if (!resp.ok) {
      console.error(`Brevo ${label} failed: ${resp.status} ${text.slice(0, 300)}`);
      return { ok: false, status: resp.status };
    }
    return { ok: true, status: resp.status, messageId: data.messageId };
  } catch (e) {
    console.error(`Brevo ${label} error:`, e.message);
    return { ok: false, status: 0 };
  }
}

// Cancel a scheduled Brevo email by messageId (used on unsubscribe).
export async function brevoCancelScheduled(messageId) {
  if (!process.env.BREVO_API_KEY || !messageId) return false;
  try {
    const resp = await fetch(`${BREVO_URL}/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'accept': 'application/json' }
    });
    // 404 = already sent or already cancelled — nothing left to stop
    if (!resp.ok && resp.status !== 404) {
      console.error(`Brevo cancel ${messageId} failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    }
    return resp.ok;
  } catch (e) {
    console.error('Brevo cancel error:', e.message);
    return false;
  }
}

// Remember scheduled messageIds on the result row so /api/unsubscribe can cancel them.
export async function rememberScheduled(supabase, resultId, messageIds) {
  const ids = (messageIds || []).filter(Boolean);
  if (!resultId || !ids.length) return;
  try {
    const { data: row } = await supabase.from('results').select('quiz_data').eq('id', resultId).single();
    const qd = row?.quiz_data || {};
    await supabase.from('results')
      .update({ quiz_data: { ...qd, scheduled_emails: [...(qd.scheduled_emails || []), ...ids] } })
      .eq('id', resultId);
  } catch (e) {
    console.error('rememberScheduled error:', e.message);
  }
}

export async function sendEmail({ to, subject, html }) {
  const resp = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Get Biz Idea', email: 'hello@getbizidea.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err);
  }
  return resp.json().catch(() => ({ ok: true }));
}
