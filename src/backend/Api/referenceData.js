/* global ReferenceDataController */

let ControllerCtor;
if (typeof globalThis !== 'undefined' && globalThis.ReferenceDataController) {
  ControllerCtor = globalThis.ReferenceDataController;
} else if (typeof module !== 'undefined' && module.exports) {
  ControllerCtor = require('../y_controllers/ReferenceDataController.js');
} else {
  ControllerCtor = ReferenceDataController;
}

/**
 * @returns {ReferenceDataController}
 */
function getController() {
  return new ControllerCtor();
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
function createCohort(params) {
  return getController().createCohort(params.record);
}

/**
 * @param {{originalName: string, record: {name: string, active?: boolean}}} params
 * @returns {{name: string, active: boolean}}
 */
function updateCohort(params) {
  return getController().updateCohort(params);
}

/**
 * @param {{name: string}} params
 * @returns {*}
 */
function deleteCohort(params) {
  return getController().deleteCohort(params.name);
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
function createYearGroup(params) {
  return getController().createYearGroup(params.record);
}

/**
 * @param {{originalName: string, record: {name: string}}} params
 * @returns {{name: string}}
 */
function updateYearGroup(params) {
  return getController().updateYearGroup(params);
}

/**
 * @param {{name: string}} params
 * @returns {*}
 */
function deleteYearGroup(params) {
  return getController().deleteYearGroup(params.name);
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
