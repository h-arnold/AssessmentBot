/**
 * TRIGGER_METHOD_HANDLERS — registry of trigger methods dispatchable by
 * triggerHandler().
 *
 * Each entry is an anonymous arrow function that instantiates its controller
 * and dispatches the validated params object. Entries MUST remain anonymous
 * arrow functions inside this const object literal — no top-level function
 * declarations — so the backend global-exposure guard scan does not flag this
 * file (the only public entrypoints are apiHandler, doGet and triggerHandler).
 *
 * @remarks
 * This registry mirrors the ALLOWLISTED_METHOD_HANDLERS pattern used by the
 * API transport layer: adding a new trigger method means adding one entry here
 * and writing the context at trigger creation time. AssignmentController is a
 * bare GAS global constructor resolved via concatenation.
 */
const TRIGGER_METHOD_HANDLERS = {
  processSelectedAssignment: (parameters) =>
    new AssignmentController().processSelectedAssignment(parameters),
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRIGGER_METHOD_HANDLERS };
}
