/**
 * Base class for social media providers.
 * Enforces the contract for adding new providers.
 */
class SocialProvider {
  /**
   * Get the provider's identifier (e.g., 'linkedin', 'x')
   * @returns {string}
   */
  get name() {
    throw new Error('Not implemented');
  }

  /**
   * Return the provider's capabilities
   * @returns {{ maxChars: number, supportsImages: boolean }}
   */
  get capabilities() {
    throw new Error('Not implemented');
  }

  /**
   * Format the content according to the provider's rules
   * @param {string} content 
   * @returns {string}
   */
  formatContent(content) {
    throw new Error('Not implemented');
  }

  /**
   * Get the authorization URL to redirect the user to
   * @param {string} state - The CSRF state token
   * @param {object} session - The express session to store temp data (like code_verifier)
   * @returns {string} URL to redirect to
   */
  getAuthUrl(state, session) {
    throw new Error('Not implemented');
  }

  /**
   * Handle the OAuth callback and exchange code for tokens
   * @param {object} req - The express request object
   * @returns {Promise<{ providerAccountId: string, accessToken: string, refreshToken: string|null, expiresIn: number|null }>}
   */
  async handleCallback(req) {
    throw new Error('Not implemented');
  }

  /**
   * Refresh the access token using the refresh token
   * @param {string} refreshToken 
   * @returns {Promise<{ accessToken: string, refreshToken: string|null, expiresIn: number|null }>}
   */
  async refreshToken(refreshToken) {
    throw new Error('Not implemented');
  }

  /**
   * Post content to the provider
   * @param {object} account - The SocialAccount record from the DB
   * @param {string} content - The formatted text to post
   * @param {string|null} imageUrl - Optional URL to an image
   * @returns {Promise<{ providerPostId: string, postUrl: string }>}
   */
  async post(account, content, imageUrl) {
    throw new Error('Not implemented');
  }
}

module.exports = SocialProvider;
