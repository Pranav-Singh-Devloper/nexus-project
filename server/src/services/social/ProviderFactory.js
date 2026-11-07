const LinkedInProvider = require('./LinkedInProvider');
const XProvider = require('./XProvider');

class ProviderFactory {
  static getProvider(name) {
    switch (name.toLowerCase()) {
      case 'linkedin':
        return new LinkedInProvider();
      case 'x':
        return new XProvider();
      default:
        throw new Error(`Unsupported provider: ${name}`);
    }
  }
}

module.exports = ProviderFactory;
