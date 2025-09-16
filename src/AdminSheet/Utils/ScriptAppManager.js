// ScriptAppManager.gs

/**
 * This class is encapsulates various ScriptApp functionality such as checking Auth modes, getting the script Id etc.
 */

class ScriptAppManager {
  constructor() {
    this.authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    console.log(
      `Auth info at time of instantiation is: ${JSON.stringify(
        this.authInfo.getAuthorizationStatus()
      )}`
    );
    this.scriptId = '';
  }

  /**
   * Retrieves the script ID and stores it in the instance
   * @returns {string} The script ID
   */
  getScriptId() {
    this.scriptId = ScriptApp.getScriptId();
    return this.scriptId;
  }

  /**
   * Checks the current authorization mode of the script
   * @returns {string} The current authorization mode (NONE, LIMITED, or FULL)
   */
  checkAuthMode() {
    console.log(`Authorisation Status is: ${JSON.stringify(this.authInfo.getAuthorizationStatus)}`);
    return this.authInfo.getAuthorizationStatus();
  }

  /**
   * Gets the authorization URL for the script
   * @returns {string} The authorization URL
   */
  getAuthorisationUrl() {
    return this.authInfo.getAuthorizationUrl();
  }

  /**
   * Handles the authorization flow by checking auth status and returning URL if needed
   * @returns {Object} Object containing auth status and URL if authorization is needed
   */
  handleAuthFlow() {
    const authStatus = this.checkAuthMode();
    if (authStatus === ScriptApp.AuthorizationStatus.REQUIRED) {
      return {
        needsAuth: true,
        authUrl: this.getAuthorisationUrl(),
      };
    }
    return {
      needsAuth: false,
      authUrl: null,
    };
  }

  /**
   * Revokes the current user's authorisation
   * @returns {Object} Status object indicating success
   */
  revokeAuthorisation() {
    try {
      ScriptApp.invalidateAuth();

      //Make sure we set the scriptAuthorised property to false so as not to break the init routine when the script next loads.
      configurationManager.setScriptAuthorised(false);
      return {
        success: true,
        message: 'Authorization successfully revoked',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to revoke authorization: ' + error.message,
      };
    }
  }
}
