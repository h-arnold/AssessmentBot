/**
 * Returns all class partial documents from the abclass_partials registry.
 *
 * Thin handler that delegates to ABClassController.getAllClassPartials().
 * Called by the API dispatcher when method is 'getABClassPartials'.
 *
 * In GAS runtime the controller is available globally. In Node test runtime,
 * require it explicitly to keep the module directly testable.
 *
 * @returns {Array<object>} Array of plain class partial objects.
 */
/* global ABClassController */
// Resolve controller constructor in both GAS and Node test runtimes.
// Prefer a provided global (test double) when available; otherwise require the real controller in Node.
let ControllerCtor;
if (typeof globalThis !== 'undefined' && globalThis.ABClassController) {
  ControllerCtor = globalThis.ABClassController;
} else if (typeof module !== 'undefined' && module.exports) {
  ControllerCtor = require('../y_controllers/ABClassController.js');
} else {
  // In GAS runtime the global symbol is available
  ControllerCtor = ABClassController;
}
/**
 * GAS-exposed handler that returns all class partials via the controller.
 * @returns {Array<object>}
 */
function getABClassPartials() {
  const controller = new ControllerCtor();
  return controller.getAllClassPartials();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getABClassPartials };
}
