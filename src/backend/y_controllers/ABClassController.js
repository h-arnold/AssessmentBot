/**
 * Re-export shim for ABClassController.
 * Node requires this path (ABClassController.js) which now delegates
 * to the new facade at ABClassController/index.js.
 * This shim is temporary — it is removed in Section 11.
 */
const ABClassController = require('./ABClassController/index.js');
module.exports = ABClassController;
