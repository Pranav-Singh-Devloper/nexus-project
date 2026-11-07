const axios = require('axios');
const SocialProvider = require('./SocialProvider');

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_SCOPES = 'openid profile email w_member_social';
const LINKEDIN_REDIRECT_URI = `${process.env.SERVER_URL || 'http://localhost:5001'}/auth/linkedin/callback`;

class LinkedInProvider extends SocialProvider {
  get name() {
    return 'linkedin';
  }

  get capabilities() {
    return {
      maxChars: 3000,
      supportsImages: true,
    };
  }

  formatContent(content) {
    // LinkedIn keeps the exact format passed (the UI converts HTML to Unicode).
    // The UI handles Unicode formatting, so we just pass the text as-is.
    return content;
  }

  getAuthUrl(state, session) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      scope: LINKEDIN_SCOPES,
      state: state
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(req) {
    const { code } = req.query;
    
    if (!code) {
      throw new Error('Authorization code missing');
    }

    // Exchange code for token
    const tokenResponse = await axios.post(LINKEDIN_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;
    const refreshToken = tokenResponse.data.refresh_token || null;

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Fetch user profile
    const profileResponse = await axios.get(LINKEDIN_USERINFO_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return {
      providerAccountId: profileResponse.data.sub,
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  async refreshToken(refreshToken) {
    // Note: LinkedIn refresh tokens are valid for a year, but typically require 
    // requesting the "offline_access" scope.
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const tokenResponse = await axios.post(LINKEDIN_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token || refreshToken,
      expiresIn: tokenResponse.data.expires_in
    };
  }

  async registerAndUploadImage(accessToken, linkedinId, imageUrl) {
    try {
      const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgResponse.data, 'binary');

      const registerResponse = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${linkedinId}`,
            serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetUrn = registerResponse.data.value.asset;

      await axios.put(uploadUrl, buffer, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'image/jpeg'
        }
      });

      return assetUrn;
    } catch (e) {
      console.error('[LinkedIn Image Upload Error]', e.response?.data || e.message);
      throw e;
    }
  }

  async post(account, content, imageUrl) {
    let mediaCategory = 'NONE';
    let mediaItems = [];

    if (imageUrl) {
      try {
        const assetUrn = await this.registerAndUploadImage(account.accessToken, account.providerAccountId, imageUrl);
        mediaCategory = 'IMAGE';
        mediaItems = [
          {
            status: 'READY',
            media: assetUrn,
            title: { text: "AI Generated Visual" }
          }
        ];
      } catch (e) {
        console.warn("Falling back to text-only post due to image upload failure.");
      }
    }

    const specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: mediaCategory
      }
    };

    if (mediaCategory !== 'NONE') {
      specificContent['com.linkedin.ugc.ShareContent'].media = mediaItems;
    }

    try {
      const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          author: `urn:li:person:${account.providerAccountId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: specificContent,
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );

      const linkedinPostId = response.data.id;
      return {
        providerPostId: linkedinPostId,
        postUrl: `https://www.linkedin.com/feed/update/${linkedinPostId}`
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

module.exports = LinkedInProvider;
