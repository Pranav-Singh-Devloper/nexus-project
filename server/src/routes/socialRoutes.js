const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ProviderFactory = require('../services/social/ProviderFactory');

// --- JWT Auth Middleware ---
const requireAuth = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });
  }

  try {
    const decoded = jwt.verify(token, process.env.COOKIE_KEY);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

/**
 * Check and refresh token if expired
 */
async function ensureValidToken(account) {
  const now = new Date();
  // Buffer of 5 minutes
  const expiryBuffer = new Date(now.getTime() + 5 * 60000);

  if (account.expiresAt && account.expiresAt < expiryBuffer) {
    console.log(`[SocialRoutes] Token expired or expiring soon for ${account.provider}. Refreshing...`);
    const providerInstance = ProviderFactory.getProvider(account.provider);
    
    try {
      const tokens = await providerInstance.refreshToken(account.refreshToken);
      const newExpiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      
      const updatedAccount = await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: newExpiresAt
        }
      });
      return updatedAccount;
    } catch (err) {
      console.error(`[SocialRoutes] Failed to refresh token for ${account.provider}:`, err.message);
      throw new Error('TOKEN_REFRESH_FAILED');
    }
  }
  return account;
}

// =============================================
// POST /api/social/:provider/post  — Publish Immediately
// =============================================
router.post('/:provider/post', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const { text, imageUrl } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  try {
    let socialAccount = await prisma.socialAccount.findUnique({
      where: { userId_provider: { userId: req.userId, provider } }
    });

    if (!socialAccount) {
      return res.status(400).json({
        error: `${provider} not connected`,
        code: 'PROVIDER_NOT_CONNECTED'
      });
    }

    // Refresh token if necessary
    try {
      socialAccount = await ensureValidToken(socialAccount);
    } catch (err) {
      return res.status(401).json({
        error: `${provider} session expired. Please reconnect.`,
        code: 'TOKEN_EXPIRED'
      });
    }

    const providerInstance = ProviderFactory.getProvider(provider);
    const formattedContent = providerInstance.formatContent(text);

    // Call API with exactly 1 retry on 401
    try {
      const result = await providerInstance.post(socialAccount, formattedContent, imageUrl);
      return res.json({ status: 'success', ...result });
    } catch (apiError) {
      // If 401, force refresh once and retry
      if (apiError.response?.status === 401) {
        console.log(`[SocialRoutes] Got 401 on post. Forcing token refresh...`);
        try {
          // Force set expiresAt to past to force refresh
          socialAccount.expiresAt = new Date(0);
          socialAccount = await ensureValidToken(socialAccount);
          
          const retryResult = await providerInstance.post(socialAccount, formattedContent, imageUrl);
          return res.json({ status: 'success', ...retryResult });
        } catch (retryError) {
          return res.status(401).json({ error: `${provider} token expired and refresh failed. Please reconnect.`, code: 'TOKEN_EXPIRED' });
        }
      }

      // Handle Rate Limit specifically
      if (apiError.code === 'RATE_LIMIT' || apiError.response?.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded for this provider', code: 'RATE_LIMIT' });
      }

      console.error(`[SocialRoutes] ${provider} API Error:`, apiError.response?.status, apiError.response?.data || apiError.message);
      return res.status(502).json({
        error: `Failed to post to ${provider}`,
        details: apiError.response?.data?.message || apiError.message || 'Unknown API error'
      });
    }

  } catch (err) {
    console.error('Post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// POST /api/social/:provider/schedule  — Schedule a Post
// =============================================
router.post('/:provider/schedule', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const { text, scheduledAt, imageUrl } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Post content is required' });
  }
  if (!scheduledAt) {
    return res.status(400).json({ error: 'Scheduled time is required' });
  }

  const scheduleDate = new Date(scheduledAt);
  if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
    return res.status(400).json({ error: 'Invalid or past scheduled time' });
  }

  const socialAccount = await prisma.socialAccount.findUnique({
    where: { userId_provider: { userId: req.userId, provider } }
  });

  if (!socialAccount) {
    return res.status(400).json({
      error: `${provider} not connected`,
      code: 'PROVIDER_NOT_CONNECTED'
    });
  }

  try {
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        provider,
        content: text,
        imageUrl: imageUrl || null,
        scheduledAt: scheduleDate,
        userId: req.userId,
        status: 'pending'
      }
    });

    return res.status(201).json({
      status: 'scheduled',
      id: scheduledPost.id,
      scheduledAt: scheduledPost.scheduledAt
    });
  } catch (err) {
    console.error('Schedule error:', err);
    return res.status(500).json({ error: 'Failed to schedule post' });
  }
});

// =============================================
// Scheduler: Process Due Scheduled Posts
// =============================================
async function processScheduledPosts() {
  try {
    const now = new Date();
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now }
      },
      include: {
        user: {
          include: { socialAccounts: true }
        }
      }
    });

    for (const post of duePosts) {
      const updated = await prisma.scheduledPost.updateMany({
        where: { id: post.id, status: 'pending' },
        data: { status: 'posting' }
      });

      if (updated.count === 0) continue;

      let socialAccount = post.user.socialAccounts.find(acc => acc.provider === post.provider);

      if (!socialAccount) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: 'failed', error: `${post.provider} account not connected` }
        });
        continue;
      }

      const providerInstance = ProviderFactory.getProvider(post.provider);
      const formattedContent = providerInstance.formatContent(post.content);

      try {
        socialAccount = await ensureValidToken(socialAccount);
        
        let result;
        try {
          result = await providerInstance.post(socialAccount, formattedContent, post.imageUrl);
        } catch (apiError) {
          if (apiError.response?.status === 401) {
            socialAccount.expiresAt = new Date(0);
            socialAccount = await ensureValidToken(socialAccount);
            result = await providerInstance.post(socialAccount, formattedContent, post.imageUrl);
          } else {
            throw apiError;
          }
        }

        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: 'published', providerPostId: result.providerPostId }
        });

        console.log(`Published scheduled post ${post.id} -> ${result.providerPostId} on ${post.provider}`);

      } catch (apiError) {
        const status = apiError.response?.status;
        const errorMsg = apiError.response?.data?.message || apiError.message;

        if (status === 401 || apiError.message === 'TOKEN_REFRESH_FAILED') {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: { status: 'failed', error: 'Token expired. Please reconnect.' }
          });
          continue;
        }

        const newRetryCount = post.retryCount + 1;
        if (newRetryCount < 3) {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: 'pending',
              retryCount: newRetryCount,
              error: `Attempt ${newRetryCount} failed: ${errorMsg}`
            }
          });
        } else {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: 'failed',
              retryCount: newRetryCount,
              error: `Failed after 3 attempts. Last error: ${errorMsg}`
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

module.exports = { router, processScheduledPosts };
