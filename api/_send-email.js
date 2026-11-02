const BREVO_SMTP = 'https://api.brevo.com/v3/smtp/email';
const brevoHeaders = () => ({
  'api-key': process.env.BREVO_API_KEY,
  'Content-Type': 'application/json',
  accept: 'application/json'
});

// Throws when Brevo rejects the message, so callers can't mistake a failed send for a sent one.
export async function sendEmail({ to, subject, html, senderName = 'Get Biz Idea', scheduledAt, tags }) {
  const resp = await fetch(BREVO_SMTP, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      sender: { name: senderName, email: 'hello@getbizidea.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(tags ? { tags } : {})
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err);
  }
  return resp.json().catch(() => ({ ok: true }));
}

export async function cancelScheduledEmail(messageId) {
  const resp = await fetch(`${BREVO_SMTP}/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: brevoHeaders()
  });
  if (!resp.ok && resp.status !== 404) throw new Error(`Cancel failed: ${resp.status}`);
}

// Blocks marketing and transactional mail to this address, including already scheduled sends.
export async function blockContact(email) {
  const resp = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      email,
      emailBlacklisted: true,
      smtpBlacklistSender: ['hello@getbizidea.com'],
      updateEnabled: true
    })
  });
  if (!resp.ok) throw new Error(await resp.text());
}
