require('dotenv').config();
require('./config/passport');

const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser'); // NEW
const jwt = require('jsonwebtoken'); // NEW
const cors = require('cors');

const projectRoutes = require('./routes/projectRoutes');
const noteRoutes = require('./routes/noteRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
    origin: process.env.CLIENT_URL,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser()); // NEW: Parse cookies to read JWT

// Session is ONLY for the OAuth handshake (Google State check)
app.use(session({
    secret: process.env.COOKIE_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProduction }
}));

app.use(passport.initialize());
// app.use(passport.session()); // REMOVED: No longer using session for user persistence

// --- JWT Helper ---
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email }, 
        process.env.COOKIE_KEY, // Reusing key as JWT Secret
        { expiresIn: '7d' }
    );
};

// --- Routes ---

// 1. Google Auth Start
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: true // We need session just for the OAuth state param
}));

// 2. Google Callback -> Issue JWT
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/', session: false }),
  (req, res) => {
    // Generate JWT
    const token = generateToken(req.user);
    
    // Set HTTP-Only Cookie
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction, // HTTPS in Prod, HTTP in Dev
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

// 3. Current User (Verify JWT)
app.get('/api/current_user', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.send(null);

    try {
        const decoded = jwt.verify(token, process.env.COOKIE_KEY);
        // Basic user info is in the token. 
        // If you need the avatar/name, you might want to query DB or put them in token.
        // For now, let's query the DB to be safe and get full profile.
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        res.send(user);
    } catch (err) {
        res.send(null);
    }
});

// 4. Logout (Clear Cookie)
app.get('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    });
    res.redirect(process.env.CLIENT_URL);
});

// API Routes (We need to update requireAuth logic in the next step)
app.use('/api/projects', projectRoutes);
app.use('/api/notes', noteRoutes);
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (JWT Mode)`);
});