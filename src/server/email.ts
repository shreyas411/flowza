/**
 * Transactional email via Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Without RESEND_API_KEY (local dev) the email is printed to the server log instead of sent.
 */

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const appLink = (params: Record<string, string>) =>
  `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/?${new URLSearchParams(params)}`;

/** Returns true when the provider accepted the email. Never throws, so callers can't leak account existence via errors. */
export async function sendEmail(to: string, subject: string, heading: string, body: string, cta: { label: string; url: string }) {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 12px">${escapeHtml(heading)}</h2>
  <p style="line-height:1.5;color:#334155">${escapeHtml(body)}</p>
  <p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>
  <p style="font-size:12px;color:#64748b">Or open this link: ${escapeHtml(cta.url)}</p>
  <p style="font-size:12px;color:#94a3b8">If you didn't expect this email you can ignore it.</p>
</div>`;
  const text = `${heading}\n\n${body}\n\n${cta.label}: ${cta.url}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set; not sending. To: ${to} | ${subject} | ${cta.url}`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Flowza <onboarding@resend.dev>', to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend rejected email to ${to}: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] Failed to reach Resend for ${to}`, err);
    return false;
  }
}
