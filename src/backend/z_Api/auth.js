/**
 * Returns whether the current user has authorised the script.
 *
 * @returns {boolean} True when authorisation is not required.
 */
function getAuthorisationStatus() {
  const scriptAppManager = new ScriptAppManager();
  return scriptAppManager.isAuthorised();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getAuthorisationStatus };
}
