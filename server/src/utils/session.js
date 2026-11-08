const jwt = require('jsonwebtoken');

// Login sessions last 30 days and are renewed while the user keeps using the app,
// so active users are never logged out. Inactive users are logged out after 30 days.
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000; // re-issue at most once a day

const isProduction = () => process.env.NODE_ENV === 'production';

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  // Frontend (Vercel) and backend (Railway) are on different sites in production.
  sameSite: isProduction() ? 'none' : 'lax',
});

function issueSession(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.COOKIE_KEY, {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie('token', token, { ...cookieOptions(), maxAge: SESSION_MS });
}

// Extend the session if the current token is more than a day old.
function renewSessionIfStale(res, decoded) {
  if (decoded?.iat && Date.now() - decoded.iat * 1000 > RENEW_AFTER_MS) {
    issueSession(res, { id: decoded.id, email: decoded.email });
  }
}

function clearSession(res) {
  res.clearCookie('token', cookieOptions());
}

// Express middleware: rejects requests without a valid session.
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });
  try {
    const decoded = jwt.verify(token, process.env.COOKIE_KEY);
    req.user = decoded;
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

module.exports = { issueSession, renewSessionIfStale, clearSession, requireAuth };
