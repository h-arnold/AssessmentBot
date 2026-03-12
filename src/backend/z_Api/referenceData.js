/* global ReferenceDataController */

/**
 * @returns {ReferenceDataController}
 */
function getController() {
  return new ReferenceDataController();
}

/**
 * @returns {Array<{name: string, active: boolean}>}
 */
function getCohorts() {
  return getController().listCohorts();
}

/**
 * @param {{record: {name: string, active?: boolean}}} params
 * @returns {{name: string, active: boolean}}
 */
function createCohort(parameters) {
  return getController().createCohort(parameters.record);
}

/**
 * @param {{originalName: string, record: {name: string, active?: boolean}}} params
 * @returns {{name: string, active: boolean}}
 */
function updateCohort(parameters) {
  return getController().updateCohort(parameters);
}

/**
 * @param {{name: string}} params
 * @returns {void}
 */
function deleteCohort(parameters) {
  return getController().deleteCohort(parameters.name);
}

/**
 * @returns {Array<{name: string}>}
 */
function getYearGroups() {
  return getController().listYearGroups();
}

/**
 * @param {{record: {name: string}}} params
 * @returns {{name: string}}
 */
function createYearGroup(parameters) {
  return getController().createYearGroup(parameters.record);
}

/**
 * @param {{originalName: string, record: {name: string}}} params
 * @returns {{name: string}}
 */
function updateYearGroup(parameters) {
  return getController().updateYearGroup(parameters);
}

/**
 * @param {{name: string}} params
 * @returns {void}
 */
function deleteYearGroup(parameters) {
  return getController().deleteYearGroup(parameters.name);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCohorts,
    createCohort,
    updateCohort,
    deleteCohort,
    getYearGroups,
    createYearGroup,
    updateYearGroup,
    deleteYearGroup,
  };
}
