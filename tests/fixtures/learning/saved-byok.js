// Synthetic saved catalog entry. Capability verification is a server contract;
// these store tests consume its persisted, checked projection without network calls.
export const savedByok = (id) => ({
  id,
  provider: 'synthetic',
  model: id,
  source: 'byok',
  configured: true,
  connectionStatus: 'connected',
  capabilities: { structured: true }
});
export function acknowledgePreferences(options) {
  if (!options.url.endsWith('/learning-models') || options.data.action !== 'preferences') return false;
  options.success({ data: { success: true, data: { preferences: options.data.preferences } } });
  return true;
}
