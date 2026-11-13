'use strict';

// The Neon Auth URL is public; passwords and payment credentials are never sent here.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const url = new URL(process.env.NEON_AUTH_BASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    return res.status(200).json({ authUrl: url.href.replace(/\/$/, '') });
  } catch {
    return res.status(503).json({ error: 'Account service unavailable' });
  }
};
