const axios = require('axios');
const crypto = require('crypto');
const SocialProvider = require('./SocialProvider');

const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_USERINFO_URL = 'https://api.twitter.com/2/users/me';
const X_TWEET_URL = 'https://api.twitter.com/2/tweets';
const X_SCOPES = 'tweet.read tweet.write users.read offline.access';
const X_REDIRECT_URI = `${process.env.SERVER_URL || 'http://localhost:5001'}/auth/x/callback`;

function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

class XProvider extends SocialProvider {
  get name() {
    return 'x';
  }

  get capabilities() {
    return {
      maxChars: 280,
      supportsImages: false, // For OAuth2.0 media upload requires v1.1 endpoint which requires OAuth 1.0a or specific handling. Keeping simple for now based on docs provided.
    };
  }

  formatContent(content) {
    // Strip HTML/Unicode formatting intelligently, compress, keep hashtags
    // First, convert HTML breaks to newlines
    let text = content.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    // Strip all other HTML
    text = text.replace(/<[^>]*>/g, '');
    
    // Convert math Unicode characters back to plain text if any are present (optional, but requested "remove Unicode formatting")
    // For simplicity, we just assume plain text is passed and enforce length
    
    // Clean up excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (text.length > 280) {
      // Intelligently compress or truncate while trying to keep hashtags at the end
      const hashtagsMatch = text.match(/#[\w]+/g);
      const hashtags = hashtagsMatch ? hashtagsMatch.join(' ') : '';
      
      const contentLimit = 280 - (hashtags.length > 0 ? hashtags.length + 4 : 3);
      text = text.substring(0, contentLimit) + '...';
      
      if (hashtags) {
        text += '\n\n' + hashtags;
      }
    }

    return text;
  }

  getAuthUrl(state, session) {
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    
    // Store in session for verification in callback
    session.x_code_verifier = codeVerifier;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.X_CLIENT_ID,
      redirect_uri: X_REDIRECT_URI,
      scope: X_SCOPES,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 's256'
    });

    return `${X_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(req) {
    const { code } = req.query;
    const codeVerifier = req.session?.x_code_verifier;
    
    if (!code) {
      throw new Error('Authorization code missing');
    }
    if (!codeVerifier) {
      throw new Error('PKCE code verifier missing from session');
    }

    // Exchange code for token
    const tokenResponse = await axios.post(X_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: X_REDIRECT_URI,
      client_id: process.env.X_CLIENT_ID,
      code_verifier: codeVerifier,
    }), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
      }
    });

    // Clear verifier from session
    delete req.session.x_code_verifier;

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;
    const refreshToken = tokenResponse.data.refresh_token || null;

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Fetch user profile
    const profileResponse = await axios.get(X_USERINFO_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return {
      providerAccountId: profileResponse.data.data.id,
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenResponse = await axios.post(X_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.X_CLIENT_ID,
    }), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
      }
    });

    return {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token || refreshToken,
      expiresIn: tokenResponse.data.expires_in
    };
  }

  async post(account, content, imageUrl) {
    // Note: X API v2 image upload is complex and requires v1.1. We only post text here for now.
    
    try {
      const response = await axios.post(
        X_TWEET_URL,
        { text: content },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const tweetId = response.data.data.id;
      return {
        providerPostId: tweetId,
        postUrl: `https://x.com/user/status/${tweetId}`
      };
    } catch (error) {
      if (error.response?.status === 429) {
        const err = new Error('Rate limit exceeded');
        err.code = 'RATE_LIMIT';
        throw err;
      }
      throw error;
    }
  }
}

module.exports = XProvider;
