/* global ABClassController */
/**
 * GAS-exposed handler that returns all class partials from the abclass_partials registry
 * via ABClassController.getAllClassPartials().
 *
 * Called by the API dispatcher when method is 'getABClassPartials'.
 *
 * @returns {Array<object>} Array of normalised class partial objects.
 */
function getABClassPartials() {
  return new ABClassController().getAllClassPartials();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getABClassPartials };
}
