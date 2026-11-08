import { API_URL } from '../config';

// LinkedIn connections last 60 days and can't be renewed in the background
// (LinkedIn only issues refresh tokens to approved partner apps), so we surface
// the expiry early and make reconnecting one click.
export const EXPIRY_WARNING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const providerName = (provider) => (provider === 'x' ? 'X' : 'LinkedIn');

// { connected, expired, expiringSoon, daysLeft, expiresAt }
export function connectionInfo(user, provider) {
  const account = user?.socialAccounts?.find(a => a.provider === provider);
  if (!account) return { connected: false, expired: false, expiringSoon: false, daysLeft: null, expiresAt: null };

  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
  const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : Infinity;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil(msLeft / DAY_MS)) : null;
  const expired = msLeft <= 0;

  return {
    connected: !expired,
    expired,
    expiringSoon: !expired && daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS,
    daysLeft,
    expiresAt,
  };
}

// Starts the provider's OAuth flow and comes back to `returnTo` afterwards.
// If the user already approved the app, LinkedIn skips the consent screen.
export const reconnectUrl = (provider, returnTo = '/profile') =>
  `${API_URL}/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;

export const formatExpiry = (info) => {
  if (!info?.expiresAt) return '';
  if (info.expired) return 'Expired';
  if (info.daysLeft <= 1) return 'Expires today';
  return `Expires in ${info.daysLeft} days`;
};
