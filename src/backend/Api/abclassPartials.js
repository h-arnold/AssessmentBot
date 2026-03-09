/**
 * Returns all class partial documents from the abclass_partials registry.
 *
 * Thin handler that delegates to ABClassController.getAllClassPartials().
 * Called by the API dispatcher when method is 'getABClassPartials'.
 *
 * @returns {Array<object>} Array of plain class partial objects.
 */
function getABClassPartials() {
  const controller = new ABClassController();
  return controller.getAllClassPartials();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getABClassPartials };
}
