const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL || 'http://localhost:5001'}/auth/google/callback`,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // 1. Check if user exists by Google ID
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
          // 2. Check if user exists by Email (Manual Account)
          user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            // LINK ACCOUNT: Add Google ID to existing manual user
            user = await prisma.user.update({
              where: { id: user.id },
              data: { 
                googleId: profile.id,
                avatar: user.avatar || profile.photos[0].value 
              }
            });
          } else {
            // 3. Create New User
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email: email,
                name: profile.displayName,
                avatar: profile.photos[0].value,
              },
            });
          }
        }
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);