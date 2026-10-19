const apiHandlerPath = '../../../src/backend/z_Api/z_apiHandler.js';
const googleClassroomsHandlerPath = '../../../src/backend/z_Api/googleClassrooms.js';
const assignmentDefinitionTransportPath =
  '../../../src/backend/z_Api/assignmentDefinitionTransport.js';
const apiConfigPath = '../../../src/backend/z_Api/apiConfig.js';
const abclassMutationsPath = '../../../src/backend/z_Api/abclass/abclassMutations.js';
const { REFERENCE_DATA_API_METHOD_NAMES } = require('#test-helpers/apiHandlerTestUtils.js');

// Constants
const ABCLASS_TRANSPORT_API_METHOD_NAMES = Object.freeze([
  'getGoogleClassroomAssignments',
  'getGoogleClassrooms',
  'upsertABClass',
  'updateABClass',
  'deleteABClass',
  'getABClass',
]);

const BACKEND_CONFIG_API_METHOD_NAMES = Object.freeze(['getBackendConfig', 'setBackendConfig']);

const ASSIGNMENT_DEFINITION_API_METHOD_NAMES = Object.freeze([
  'getAssignmentDefinitionPartials',
  'getAssignmentDefinition',
  'deleteAssignmentDefinition',
]);

const EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS = Object.freeze([
  'hasScriptAuthorisation',
  'getABClassPartials',
  ...ASSIGNMENT_DEFINITION_API_METHOD_NAMES,
  'upsertAssignmentDefinition',
  'getAssignment',
  ...ABCLASS_TRANSPORT_API_METHOD_NAMES,
  ...BACKEND_CONFIG_API_METHOD_NAMES,
  'startAssessmentRun',
  ...REFERENCE_DATA_API_METHOD_NAMES,
]);

const ABCLASS_TRANSPORT_PARAMS = Object.freeze({
  getGoogleClassroomAssignments: { classId: 'course-001' },
  getGoogleClassrooms: {},
  upsertABClass: {
    classId: 'class-upsert-001',
    cohortKey: 'coh-2026',
    yearGroupKey: 'yg-10',
    courseLength: 2,
  },
  updateABClass: {
    classId: 'class-update-001',
    cohortKey: 'coh-2027',
    yearGroupKey: 'yg-11',
    courseLength: 2,
    active: true,
  },
  deleteABClass: {
    classId: 'class-delete-001',
  },
  getABClass: {
    classId: 'class-read-001',
  },
});

const ABCLASS_TRANSPORT_RESULTS = Object.freeze({
  getGoogleClassroomAssignments: [{ assignmentId: 'a1', title: 'Essay' }],
  getGoogleClassrooms: [{ classId: 'course-001', className: '10A Computer Science' }],
  upsertABClass: { classId: 'class-upsert-001', saved: true },
  updateABClass: { classId: 'class-update-001', updated: true },
  deleteABClass: { classId: 'class-delete-001', deleted: true },
  getABClass: { classId: 'class-read-001', className: '10A Computer Science' },
});

const REFERENCE_DATA_RESULTS = Object.freeze({
  getCohorts: [
    { key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
  ],
  createCohort: {
    key: 'coh-2026',
    name: 'Cohort 2026',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  updateCohort: {
    key: 'coh-2025',
    name: 'Cohort 2026',
    active: false,
    startYear: 2025,
    startMonth: 9,
  },
  getYearGroups: [{ key: 'yg-10', name: 'Year 10' }],
  createYearGroup: { key: 'yg-10', name: 'Year 10' },
  updateYearGroup: { key: 'yg-9', name: 'Year 10' },
  getAssignmentTopics: [{ key: 'topic-algebra', name: 'Algebra' }],
  createAssignmentTopic: { key: 'topic-algebra', name: 'Algebra' },
  updateAssignmentTopic: { key: 'topic-algebra', name: 'Advanced Algebra' },
  // Delete handlers are intentionally transport-void; keep explicit nulls to avoid implicit undefined stubs.
  deleteCohort: null,
  deleteYearGroup: null,
  deleteAssignmentTopic: null,
});

const ASSIGNMENT_DEFINITION_RESULTS = Object.freeze({
  getAssignmentDefinitionPartials: [
    {
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      courseId: 'course-001',
      yearGroupKey: 'year-group-10',
      alternateTitles: ['Algebra Starter'],
      alternateTopics: ['Linear Equations'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      assignmentWeighting: null,
      definitionKey: 'algebra-baseline',
      tasks: null,
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-06T12:30:00.000Z',
    },
  ],
  getAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: 1,
    tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
  },
  // deleteAssignmentDefinition handler returns undefined, which is coerced to null by _success()
  deleteAssignmentDefinition: null,
});

const ASSIGNMENT_DEFINITION_PARAMS = Object.freeze({
  getAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
  },
  deleteAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
  },
});

const REFERENCE_DATA_PARAMS = Object.freeze({
  createCohort: { record: { name: 'Cohort 2026', active: true } },
  updateCohort: {
    key: 'coh-2025',
    record: { key: 'coh-2025', name: 'Cohort 2026', active: false },
  },
  deleteCohort: { key: 'coh-2026' },
  createYearGroup: { record: { name: 'Year 10' } },
  updateYearGroup: {
    key: 'yg-9',
    record: { key: 'yg-9', name: 'Year 10' },
  },
  deleteYearGroup: { key: 'yg-10' },
  createAssignmentTopic: { record: { name: 'Algebra' } },
  updateAssignmentTopic: {
    key: 'topic-algebra',
    record: { key: 'topic-algebra', name: 'Advanced Algebra' },
  },
  deleteAssignmentTopic: { key: 'topic-algebra' },
});

const REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD = Object.freeze({
  getCohorts: 'listCohorts',
  getYearGroups: 'listYearGroups',
  getAssignmentTopics: 'listAssignmentTopics',
});

function getReferenceDataControllerMethodName(methodName) {
  return REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD[methodName] || methodName;
}

function getReferenceDataControllerMethodSpy(context, methodName) {
  return context.referenceDataControllerInstance[getReferenceDataControllerMethodName(methodName)];
}

function getAllowlistedHandlerSpy(context, handlerName) {
  if (REFERENCE_DATA_API_METHOD_NAMES.includes(handlerName)) {
    return getReferenceDataControllerMethodSpy(context, handlerName);
  }

  return context[`${handlerName}_`];
}
const INVALID_REQUEST_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps controller validation failures for reference-data handlers to the existing API failure envelope',
    methodName: 'createCohort',
    params: REFERENCE_DATA_PARAMS.createCohort,
    handlerName: 'createCohort',
    errorMessage: 'Invalid cohort payload',
    requestId: 'req-create-cohort',
    withRequestId: false,
  },
  {
    description:
      'maps ApiValidationError from upsertABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'upsertABClass',
    params: ABCLASS_TRANSPORT_PARAMS.upsertABClass,
    handlerName: 'upsertABClass',
    errorMessage: 'Invalid ABClass payload',
    requestId: 'req-upsert-abclass',
    withRequestId: true,
  },
  {
    description:
      'maps ApiValidationError from updateABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'updateABClass',
    params: ABCLASS_TRANSPORT_PARAMS.updateABClass,
    handlerName: 'updateABClass',
    errorMessage: 'Invalid ABClass update payload',
    requestId: 'req-update-abclass',
    withRequestId: true,
  },
]);

const IN_USE_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteCohort to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteCohort',
    params: REFERENCE_DATA_PARAMS.deleteCohort,
    handlerName: 'deleteCohort',
    errorMessage: 'Cohort record is referenced by one or more classes',
  },
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteYearGroup to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteYearGroup',
    params: REFERENCE_DATA_PARAMS.deleteYearGroup,
    handlerName: 'deleteYearGroup',
    errorMessage: 'Year group record is referenced by one or more classes',
  },
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteAssignmentTopic to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteAssignmentTopic',
    params: REFERENCE_DATA_PARAMS.deleteAssignmentTopic,
    handlerName: 'deleteAssignmentTopic',
    errorMessage: 'Assignment topic record is referenced by one or more assignment definitions',
  },
]);
module.exports = {
  apiHandlerPath,
  googleClassroomsHandlerPath,
  assignmentDefinitionTransportPath,
  apiConfigPath,
  abclassMutationsPath,
  ABCLASS_TRANSPORT_API_METHOD_NAMES,
  BACKEND_CONFIG_API_METHOD_NAMES,
  ASSIGNMENT_DEFINITION_API_METHOD_NAMES,
  EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS,
  ABCLASS_TRANSPORT_PARAMS,
  ABCLASS_TRANSPORT_RESULTS,
  REFERENCE_DATA_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
  ASSIGNMENT_DEFINITION_PARAMS,
  REFERENCE_DATA_PARAMS,
  REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD,
  INVALID_REQUEST_FAILURE_CASES,
  IN_USE_FAILURE_CASES,
  getReferenceDataControllerMethodName,
  getReferenceDataControllerMethodSpy,
  getAllowlistedHandlerSpy,
};
