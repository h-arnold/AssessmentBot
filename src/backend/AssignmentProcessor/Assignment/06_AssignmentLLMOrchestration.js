/**
 * AssignmentLLMOrchestration — LLM orchestration sub-class
 *
 * Owns generateLLMRequests(), assessResponses(), and _getLLMManager().
 *
 * Operates on the parent Assignment instance via this._assignment.
 * Depends on global `LLMRequestManager`, `Utils.toastMessage`, and `ABLogger` (GAS runtime globals).
 * @class
 */

const INFO_TOAST_DURATION_SECONDS = 3;

/**
 *
 */
class AssignmentLLMOrchestration {
  /**
   * Constructor.
   * @param {import('../Assignment.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('../Assignment.js')} */
    this._assignment = assignment;
  }

  /**
   * Generates an array of request objects ready to be sent to the LLM.
   * @returns {Object[]} An array of request objects.
   */
  generateLLMRequests() {
    return this._getLLMManager().generateRequestObjects(this._assignment);
  }

  /**
   * Assesses student responses by interacting with the LLM.
   * Generates LLM requests for all submissions and processes responses.
   * @returns {void}
   */
  assessResponses() {
    // Base Assignment only handles non-spreadsheet (text/table/image) via LLM
    const manager = this._getLLMManager();
    const requests = manager.generateRequestObjects(this._assignment);
    if (!requests || requests.length === 0) {
      Utils.toastMessage('No LLM requests to send.', 'Info', INFO_TOAST_DURATION_SECONDS);
      return;
    }
    manager.processStudentResponses(requests, this._assignment);
  }

  /**
   * Creates and returns an LLMRequestManager instance.
   * Centralises construction to reduce duplicated logic across multiple methods.
   * @returns {LLMRequestManager} A new LLMRequestManager instance.
   */
  _getLLMManager() {
    return new LLMRequestManager();
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentLLMOrchestration;
}
