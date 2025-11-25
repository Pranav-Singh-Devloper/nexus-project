require('dotenv').config();
// Import passport config BEFORE using it
require('./config/passport'); 

const express = require('express');
const passport = require('passport');
const session = require('express-session'); // CHANGED
const cors = require('cors');
const projectRoutes = require('./routes/projectRoutes');

const app = express();
app.use(express.json());

// 1. TRUST PROXY (Required for Render/Heroku to pass cookies)
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL, 
    methods: 'GET,POST,PUT,DELETE',
    credentials: true, 
  })
);

// 2. UPDATE SESSION CONFIG
app.use(
  session({
    secret: process.env.COOKIE_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // MUST be true for cross-site cookies
      sameSite: 'none', // MUST be 'none' to allow Vercel to read Render cookies
      maxAge: 24 * 60 * 60 * 1000 
    }
  })
);

// Re-generate session function for Passport (Optional fix for some edge cases, usually express-session handles it)
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb) => {
      cb();
    };
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb) => {
      cb();
    };
  }
  next();
});
// --- CHANGED SECTION END ---

app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---

// Register Routes
app.use('/api/projects', projectRoutes);

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful login, redirect to Frontend Dashboard
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

app.get('/api/current_user', (req, res) => {
  res.send(req.user);
});

app.get('/api/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.CLIENT_URL);
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});