/**
 * Returns all class partial documents from the abclass_partials registry.
 *
 * Thin handler that delegates to ABClassController.getAllClassPartials().
 * Called by the API dispatcher when method is 'getABClassPartials'.
 *
 * @returns {Array<object>} Array of plain class partial objects.
 */
/* global ABClassController */
/**
 * GAS-exposed handler that returns all class partials via the controller.
 *
 * @returns {Array<object>} Array of normalised class partial objects.
 */
function getABClassPartials() {
  return new ABClassController().getAllClassPartials();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getABClassPartials };
}
