/* global ReferenceDataController */

/**
 * Factory function that returns a new ReferenceDataController instance.
 *
 * @returns {ReferenceDataController} A new controller instance.
 */
function getController() {
  return new ReferenceDataController();
}

/**
 * Handler that retrieves all cohort records.
 *
 * @param {*} parameters - Optional; currently unused.
 * @returns {Array<{name: string, active: boolean}>} List of all cohorts.
 */
function getCohorts() {
  return getController().listCohorts();
}

/**
 * Handler that creates a new cohort record.
 *
 * @param {Object} parameters - Request payload.
 * @param {{record: {name: string, active?: boolean}}} parameters - Contains the cohort record to create.
 * @returns {{name: string, active: boolean}} The created cohort record.
 */
function createCohort(parameters) {
  return getController().createCohort(parameters.record);
}

/**
 * Handler that updates an existing cohort record.
 *
 * @param {Object} parameters - Request payload.
 * @param {{originalName: string, record: {name: string, active?: boolean}}} parameters - Original name and updated record.
 * @returns {{name: string, active: boolean}} The updated cohort record.
 */
function updateCohort(parameters) {
  return getController().updateCohort(parameters);
}

/**
 * Handler that deletes a cohort record by name.
 *
 * @param {Object} parameters - Request payload.
 * @param {{name: string}} parameters - The cohort name to delete.
 * @returns {void}
 */
function deleteCohort(parameters) {
  return getController().deleteCohort(parameters.name);
}

/**
 * Handler that retrieves all year group records.
 *
 * @param {*} parameters - Optional; currently unused.
 * @returns {Array<{name: string}>} List of all year groups.
 */
function getYearGroups() {
  return getController().listYearGroups();
}

/**
 * Handler that creates a new year group record.
 *
 * @param {Object} parameters - Request payload.
 * @param {{record: {name: string}}} parameters - Contains the year group record to create.
 * @returns {{name: string}} The created year group record.
 */
function createYearGroup(parameters) {
  return getController().createYearGroup(parameters.record);
}

/**
 * Handler that updates an existing year group record.
 *
 * @param {Object} parameters - Request payload.
 * @param {{originalName: string, record: {name: string}}} parameters - Original name and updated record.
 * @returns {{name: string}} The updated year group record.
 */
function updateYearGroup(parameters) {
  return getController().updateYearGroup(parameters);
}

/**
 * Handler that deletes a year group record by name.
 *
 * @param {Object} parameters - Request payload.
 * @param {{name: string}} parameters - The year group name to delete.
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
