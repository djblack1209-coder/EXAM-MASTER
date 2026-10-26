import { captureSession, checkSession, readSessionSnapshot } from './auth-storage.js';

const authCodes = new Set([
  'AUTH_REQUIRED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'ACCOUNT_UNAVAILABLE',
  'ACCOUNT_DELETED'
]);
const providerCodes = new Set(['KEY_INVALID', 'MODEL_UNAVAILABLE', 'RATE_LIMITED', 'BUDGET_EXCEEDED']);
export function isAuthenticationFailure(value, statusCode) {
  if (Number(statusCode) !== 401 && (value?.success === true || value?.code === 0)) return false;
  const code = value?.errorCode || value?.error;
  if (providerCodes.has(code) || (value?.connectionError && !authCodes.has(value.connectionError))) return false;
  return Number(statusCode) === 401 || Number(value?.code) === 401 || authCodes.has(code);
}

// Only identity bindings are emitted, never a token or response body.
export function reportAuthenticationFailure(value, { session, credentialProof, path, statusCode, silent = false }) {
  if (!isAuthenticationFailure(value, statusCode) || !session || session.owner === 'guest') return false;
  const current = readSessionSnapshot();
  if (current.status !== 'current' || checkSession(session) !== 'current' || current.session.proof !== credentialProof)
    return false;
  uni.$emit('authFailure', { statusCode: 401, path, session, credentialProof, silent });
  return true;
}

export async function clearFailedAuthentication(event, logout) {
  if (!event?.session || event.session.owner === 'guest') return false;
  const current = readSessionSnapshot();
  if (
    current.status !== 'current' ||
    checkSession(event.session) !== 'current' ||
    current.session.proof !== event.credentialProof
  )
    return false;
  const result = await logout({ session: event.session, credentialProof: event.credentialProof });
  const remaining = captureSession();
  return result?.success !== false && remaining?.owner === 'guest';
}
