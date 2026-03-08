/**
 * Backend compatibility wrapper for ClassroomApiClient.
 *
 * During backend migration this keeps the active backend import surface stable
 * while the implementation still resides in the legacy source tree.
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('../../AdminSheet/GoogleClassroom/ClassroomApiClient.js');
}
