// Vercel serverless function: POST /api/joined
// Called by the app right after a brand-new account first signs in. Emails the owner once.
//
// Vercel environment variables:
//   FIREBASE_API_KEY  (already set)  used to check the caller's sign-in token
//   RESEND_API_KEY    (required)     your Resend API key
//   NOTIFY_EMAIL      (required)     where the email goes (with the free Resend test sender, use the email you signed up to Resend with)
//   NOTIFY_FROM       (optional)     defaults to "Bottle Notes <onboarding@resend.dev>"

const FRESH_MS = 15 * 60 * 1000; // only accounts created in the last 15 minutes count as "new"

async function lookup(header, apiKey) {
  const m = /^Bearer\s+(\S+)$/.exec(String(header || ''));
  if (!m) return null;
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: m[1] })
    });
    if (!r.ok) return null;
    const j = await r.json();
    const u = j && j.users && j.users[0];
    return u && !u.disabled ? u : null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const fbKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!fbKey || !resendKey || !to) return res.status(503).json({ error: 'not_configured' });

  const u = await lookup(req.headers.authorization, fbKey);
  if (!u) return res.status(401).json({ error: 'signin' });

  const created = Number(u.createdAt);
  if (!created || Date.now() - created > FRESH_MS) return res.status(200).json({ sent: false, reason: 'not_new' });

  const email = String(u.email || 'unknown').slice(0, 200);
  const method = (u.providerUserInfo || []).some((p) => p.providerId === 'google.com') ? 'Google' : 'email and password';
  const when = new Date(created).toUTCString();
  const lines = [
    'Someone just joined Bottle Notes.',
    '',
    'Email: ' + email + (u.emailVerified ? ' (verified)' : ' (not verified yet)'),
    'Signed up with: ' + method,
    'When: ' + when,
    '',
    'To remove them: Firebase console, Authentication, Users, the three dots next to their email, Disable account (or Delete account).'
  ];
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + resendKey },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'Bottle Notes <onboarding@resend.dev>',
        to: [to],
        subject: 'New Bottle Notes sign-up: ' + email.replace(/[\r\n]/g, ' '),
        text: lines.join('\n')
      })
    });
    if (!r.ok) {
      console.error('joined: Resend returned', r.status, (await r.text()).slice(0, 200));
      return res.status(502).json({ error: 'email_failed' });
    }
    return res.status(200).json({ sent: true });
  } catch (e) {
    console.error('joined: network error', e && e.message);
    return res.status(502).json({ error: 'email_failed' });
  }
};
