// Vercel serverless function: GET /api/config
// Hands the browser the public Firebase web settings, read from Vercel environment variables.
// These values are not secrets (they identify the project; the database rules protect the data).
// If FIREBASE_API_KEY or FIREBASE_PROJECT_ID is missing, the app runs in local-only mode.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.FIREBASE_API_KEY || '';
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!apiKey || !projectId) return res.status(404).json({ error: 'not_configured' });
  return res.status(200).json({
    apiKey,
    projectId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || projectId + '.firebaseapp.com',
    appId: process.env.FIREBASE_APP_ID || ''
  });
};
