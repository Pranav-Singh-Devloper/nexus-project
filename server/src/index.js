require('dotenv').config();
require('./config/passport');

const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projectRoutes = require('./routes/projectRoutes');
const noteRoutes = require('./routes/noteRoutes');
const authRoutes = require('./routes/authRoutes');
const { router: socialRoutes, processScheduledPosts } = require('./routes/socialRoutes');
const ProviderFactory = require('./services/social/ProviderFactory');
const crypto = require('crypto');
const { issueSession, renewSessionIfStale, clearSession } = require('./utils/session');
const draftRoutes = require('./routes/draftRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
    origin: process.env.CLIENT_URL,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Session is ONLY for the OAuth handshake (Google State check)
app.use(session({
    secret: process.env.COOKIE_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProduction }
}));

app.use(passport.initialize());

// --- Routes ---

// 1. Google Auth Start
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: true
}));

// 2. Google Callback -> Issue JWT
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/?error=google_failed`, session: false }),
  (req, res) => {
    issueSession(res, req.user);
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

// =============================================
// Social Media Auth (OAuth2)
// =============================================

// Only allow returning to a path inside our own frontend (e.g. "/compose?draft=..").
const safeReturnPath = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/profile';

// Step 1: Redirect user to authorization page
app.get('/auth/:provider', (req, res) => {
  const { provider } = req.params;
  const token = req.cookies.token;
  if (!token) {
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=not_logged_in`);
  }

  try {
    jwt.verify(token, process.env.COOKIE_KEY);
  } catch (err) {
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=invalid_token`);
  }

  try {
    const socialProvider = ProviderFactory.getProvider(provider);
    
    // Generate secure state
    const state = crypto.randomBytes(16).toString('hex');
    req.session[`${provider}_oauth_state`] = state;
    req.session[`${provider}_return_to`] = safeReturnPath(req.query.returnTo);

    const authUrl = socialProvider.getAuthUrl(state, req.session);
    res.redirect(authUrl);
  } catch (err) {
    console.error(`[Social Auth] Failed to init ${provider} auth:`, err);
    res.redirect(`${process.env.CLIENT_URL}/profile?error=invalid_provider`);
  }
});

// Step 2: Handle callback
app.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, error, state } = req.query;

  if (error || !code) {
    console.error(`[${provider}] Callback error:`, error);
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=${provider}_denied`);
  }

  // Verify state
  const savedState = req.session[`${provider}_oauth_state`];
  if (!state || state !== savedState) {
    console.error(`[${provider}] Invalid state parameter`);
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=invalid_state`);
  }
  delete req.session[`${provider}_oauth_state`];

  // Verify user is logged in
  const token = req.cookies.token;
  if (!token) {
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=not_logged_in`);
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.COOKIE_KEY);
    userId = decoded.id;
  } catch (err) {
    return res.redirect(`${process.env.CLIENT_URL}/profile?error=invalid_token`);
  }

  try {
    const socialProvider = ProviderFactory.getProvider(provider);
    
    console.log(`[${provider}] Handling callback...`);
    const { providerAccountId, accessToken, refreshToken, expiresIn } = await socialProvider.handleCallback(req);

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // default 60 days if missing but strictly required for oauth2.

    await prisma.socialAccount.upsert({
      where: {
        userId_provider: {
          userId: userId,
          provider: provider
        }
      },
      update: {
        providerAccountId,
        accessToken,
        refreshToken,
        expiresAt,
      },
      create: {
        provider,
        providerAccountId,
        accessToken,
        refreshToken,
        expiresAt,
        userId: userId,
      }
    });

    console.log(`[${provider}] Account linked successfully for user:`, userId);
    const returnTo = req.session[`${provider}_return_to`] || '/profile';
    delete req.session[`${provider}_return_to`];
    const sep = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${process.env.CLIENT_URL}${returnTo}${sep}${provider}=success`);

  } catch (err) {
    console.error(`[${provider}] Token exchange error:`, err.response?.data || err.message);
    res.redirect(`${process.env.CLIENT_URL}/profile?error=${provider}_failed`);
  }
});

// 3. Current User (Verify JWT)
app.get('/api/current_user', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.send(null);

    try {
        const decoded = jwt.verify(token, process.env.COOKIE_KEY);
        renewSessionIfStale(res, decoded);
        // Never send the password hash or social OAuth tokens to the browser
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true, email: true, name: true, avatar: true, createdAt: true,
                socialAccounts: { select: { id: true, provider: true, expiresAt: true, createdAt: true } }
            }
        });
        res.send(user);
    } catch (err) {
        res.send(null);
    }
});

// 4. Logout (Clear Cookie)
app.get('/api/logout', (req, res) => {
    clearSession(res);
    res.redirect(process.env.CLIENT_URL);
});

// --- Generate LinkedIn Post (AI Proxy) ---
app.post('/api/generate-linkedin-post', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    jwt.verify(token, process.env.COOKIE_KEY);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await axios.post(`${aiUrl}/generate-post`, { content }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(response.data);
  } catch (err) {
    console.error('[Generate Post] AI Engine error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const detail = err.response?.data?.detail || 'Failed to generate post';
    res.status(status).json({ error: detail });
  }
});

// --- Generate Image (AI Proxy) ---
app.post('/api/generate-image', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    jwt.verify(token, process.env.COOKIE_KEY);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { prompt, style } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await axios.post(`${aiUrl}/generate-image`, { prompt, style }, {
      timeout: 60000, // AI engine waits up to 45s on the image API
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(response.data);
  } catch (err) {
    console.error('[Generate Image] AI Engine error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const detail = err.response?.data?.detail || err.response?.data?.error || 'Failed to generate image';
    res.status(status).json({ error: detail });
  }
});

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/notes', noteRoutes);
app.use('/auth', authRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/drafts', draftRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (JWT Mode)`);

  // Start scheduled post processor — runs every 60 seconds
  setInterval(processScheduledPosts, 60000);
  console.log('Scheduler started: checking for due posts every 60s');
});