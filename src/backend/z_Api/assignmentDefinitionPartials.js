/* global AssignmentDefinitionController, ApiValidationError */

const PARTIAL_REQUIRED_FIELDS = Object.freeze([
  'primaryTitle',
  'primaryTopic',
  'primaryTopicKey',
  'yearGroup',
  'alternateTitles',
  'alternateTopics',
  'documentType',
  'referenceDocumentId',
  'templateDocumentId',
  'assignmentWeighting',
  'definitionKey',
  'tasks',
  'createdAt',
  'updatedAt',
]);

const RESPONSE_FIELD_NAME = 'response';
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;
const MAX_OFFSET_HOURS = 23;
const MAX_OFFSET_MINUTES = 59;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;
const NEGATIVE_TIMEZONE_MULTIPLIER = -1;

/**
 * Returns a new assignment-definition controller instance.
 *
 * @returns {AssignmentDefinitionController} Controller instance.
 */
function getAssignmentDefinitionController_() {
  return new AssignmentDefinitionController();
}

/**
 * Throws a transport validation error for assignment-definition partials.
 *
 * @param {string} message - Validation failure message.
 * @param {string|null} fieldName - Related field name.
 * @param {number} rowIndex - Invalid row index.
 * @throws {ApiValidationError} Always throws.
 */
function throwValidationError_(message, fieldName, rowIndex) {
  throw new ApiValidationError(message, {
    method: 'getAssignmentDefinitionPartials',
    fieldName,
    details: `rowIndex=${rowIndex}`,
  });
}

/**
 * Throws a transport validation error for assignment-definition delete operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwDeleteValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'deleteAssignmentDefinition',
    fieldName,
  });
}

const LAST_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;
const UPSERT_REQUIRED_FIELDS = Object.freeze([
  'primaryTitle',
  'primaryTopicKey',
  'referenceDocumentId',
  'templateDocumentId',
]);
const WIZARD_UPSERT_REQUIRED_FIELDS = Object.freeze([
  'primaryTitle',
  'primaryTopicKey',
  'referenceDocumentUrl',
  'templateDocumentUrl',
]);
const DOCS_URL_HOST = 'docs.google.com';
const DOCUMENT_TYPE_BY_PATH_PREFIX = Object.freeze({
  '/presentation/d/': 'SLIDES',
  '/spreadsheets/d/': 'SHEETS',
});

/**
 * Returns whether the provided key contains control characters.
 *
 * @param {string} value - Definition key candidate.
 * @returns {boolean} True when any control character is present.
 */
function hasControlCharacters_(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint <= LAST_CONTROL_CHARACTER_CODE || codePoint === DELETE_CHARACTER_CODE) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a safe, non-empty, already-trimmed identifier string.
 *
 * @param {*} value - Identifier candidate.
 * @param {Object} options - Validation options.
 * @param {Function} options.throwValidationError - Context-specific validation thrower.
 * @param {string} options.typeErrorMessage - Type-validation error message.
 * @param {string} options.nonEmptyErrorMessage - Non-empty-validation error message.
 * @param {string} options.trimmedErrorMessage - Trimmed-shape-validation error message.
 * @param {string} options.unsafeErrorMessage - Unsafe-character-validation error message.
 * @param {Object} options.fieldNames - Field names for diagnostics.
 * @param {string} options.fieldNames.type - Field name for type errors.
 * @param {string} options.fieldNames.nonEmpty - Field name for non-empty errors.
 * @param {string} options.fieldNames.trimmed - Field name for trimmed-shape errors.
 * @param {string} options.fieldNames.unsafe - Field name for unsafe-character errors.
 */
function validateSafeTrimmedIdentifier_(value, options) {
  const {
    throwValidationError,
    typeErrorMessage,
    nonEmptyErrorMessage,
    trimmedErrorMessage,
    unsafeErrorMessage,
    fieldNames,
  } = options;

  if (typeof value !== 'string') {
    throwValidationError(typeErrorMessage, fieldNames.type);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throwValidationError(nonEmptyErrorMessage, fieldNames.nonEmpty);
  }

  if (trimmedValue !== value) {
    throwValidationError(trimmedErrorMessage, fieldNames.trimmed);
  }

  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    hasControlCharacters_(value)
  ) {
    throwValidationError(unsafeErrorMessage, fieldNames.unsafe);
  }
}

/**
 * Validates delete parameters with strict safe-key requirements.
 *
 * @param {*} parameters - Candidate request parameters.
 * @returns {string} The original validated definition key.
 * @throws {ApiValidationError} If parameters or definitionKey are invalid.
 */
function validateDeleteParameters_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throwDeleteValidationError_('params must be an object.', 'params');
  }

  if (!Object.hasOwn(parameters, 'definitionKey')) {
    throwDeleteValidationError_('Missing required field: definitionKey.', 'definitionKey');
  }

  const { definitionKey } = parameters;

  validateSafeTrimmedIdentifier_(definitionKey, {
    throwValidationError: throwDeleteValidationError_,
    typeErrorMessage: 'definitionKey must be a string.',
    nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
    trimmedErrorMessage: 'definitionKey must already be trimmed.',
    unsafeErrorMessage: 'definitionKey contains unsafe characters.',
    fieldNames: {
      type: 'definitionKey',
      nonEmpty: 'definitionKey',
      trimmed: 'definitionKey',
      unsafe: 'definitionKey',
    },
  });

  return definitionKey;
}

/**
 * Throws a transport validation error for assignment-definition upsert operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string|null} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwUpsertValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'upsertAssignmentDefinition',
    fieldName,
  });
}

/**
 * Validates payload shape and required fields for assignment-definition upsert transport.
 *
 * @param {*} parameters - Candidate request payload.
 * @throws {ApiValidationError} If the payload violates transport contract rules.
 */
function validateUpsertParameters_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throwUpsertValidationError_('params must be an object.', 'params');
  }

  const shouldTranslateDocumentUrls =
    Object.hasOwn(parameters, 'referenceDocumentUrl') ||
    Object.hasOwn(parameters, 'templateDocumentUrl');

  if (shouldTranslateDocumentUrls) {
    validateWizardUpsertParameters_(parameters);
    return;
  }

  UPSERT_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!Object.hasOwn(parameters, fieldName)) {
      throwUpsertValidationError_(`Missing required field: ${fieldName}.`, fieldName);
    }
  });

  if (typeof parameters.primaryTitle !== 'string') {
    throwUpsertValidationError_('primaryTitle must be a string.', 'primaryTitle');
  }

  validateSafeTrimmedIdentifier_(parameters.primaryTopicKey, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: 'primaryTopicKey must be a string.',
    nonEmptyErrorMessage: 'primaryTopicKey must be a non-empty string.',
    trimmedErrorMessage: 'primaryTopicKey must already be trimmed.',
    unsafeErrorMessage: 'primaryTopicKey contains unsafe characters.',
    fieldNames: {
      type: 'primaryTopicKey',
      nonEmpty: 'primaryTopicKey',
      trimmed: 'primaryTopicKey',
      unsafe: 'primaryTopicKey',
    },
  });

  if (typeof parameters.referenceDocumentId !== 'string') {
    throwUpsertValidationError_('referenceDocumentId must be a string.', 'referenceDocumentId');
  }

  if (typeof parameters.templateDocumentId !== 'string') {
    throwUpsertValidationError_('templateDocumentId must be a string.', 'templateDocumentId');
  }

  if (Object.hasOwn(parameters, 'definitionKey') && parameters.definitionKey !== null) {
    validateSafeTrimmedIdentifier_(parameters.definitionKey, {
      throwValidationError: throwUpsertValidationError_,
      typeErrorMessage: 'definitionKey must be a string when provided.',
      nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
      trimmedErrorMessage: 'definitionKey must already be trimmed.',
      unsafeErrorMessage: 'definitionKey contains unsafe characters.',
      fieldNames: {
        type: 'definitionKey',
        nonEmpty: 'definitionKey',
        trimmed: 'definitionKey',
        unsafe: 'definitionKey',
      },
    });
  }

  validateTaskWeightingsShape_(parameters.taskWeightings);
  validateRequiredYearGroupKey_(parameters);
}

/**
 * Validates the wizard URL-style upsert transport payload.
 *
 * @param {Object} parameters - Candidate upsert payload.
 * @throws {ApiValidationError} If the payload violates transport contract rules.
 */
function validateWizardUpsertParameters_(parameters) {
  WIZARD_UPSERT_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!Object.hasOwn(parameters, fieldName)) {
      throwUpsertValidationError_(`Missing required field: ${fieldName}.`, fieldName);
    }
  });

  if (typeof parameters.primaryTitle !== 'string') {
    throwUpsertValidationError_('primaryTitle must be a string.', 'primaryTitle');
  }

  validateSafeTrimmedIdentifier_(parameters.primaryTopicKey, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: 'primaryTopicKey must be a string.',
    nonEmptyErrorMessage: 'primaryTopicKey must be a non-empty string.',
    trimmedErrorMessage: 'primaryTopicKey must already be trimmed.',
    unsafeErrorMessage: 'primaryTopicKey contains unsafe characters.',
    fieldNames: {
      type: 'primaryTopicKey',
      nonEmpty: 'primaryTopicKey',
      trimmed: 'primaryTopicKey',
      unsafe: 'primaryTopicKey',
    },
  });

  if (Object.hasOwn(parameters, 'definitionKey') && parameters.definitionKey !== null) {
    validateSafeTrimmedIdentifier_(parameters.definitionKey, {
      throwValidationError: throwUpsertValidationError_,
      typeErrorMessage: 'definitionKey must be a string when provided.',
      nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
      trimmedErrorMessage: 'definitionKey must already be trimmed.',
      unsafeErrorMessage: 'definitionKey contains unsafe characters.',
      fieldNames: {
        type: 'definitionKey',
        nonEmpty: 'definitionKey',
        trimmed: 'definitionKey',
        unsafe: 'definitionKey',
      },
    });
  }

  validateRequiredYearGroupKey_(parameters);
  validateTaskWeightingsShape_(parameters.taskWeightings);

  const referenceDescriptor = extractSupportedDocumentDescriptor_(
    parameters.referenceDocumentUrl,
    'referenceDocumentUrl'
  );
  const templateDescriptor = extractSupportedDocumentDescriptor_(
    parameters.templateDocumentUrl,
    'templateDocumentUrl'
  );

  if (referenceDescriptor.documentId === templateDescriptor.documentId) {
    throwUpsertValidationError_(
      'referenceDocumentUrl and templateDocumentUrl must point to different documents.',
      'referenceDocumentUrl'
    );
  }

  if (referenceDescriptor.documentType !== templateDescriptor.documentType) {
    throwUpsertValidationError_(
      'referenceDocumentUrl and templateDocumentUrl must use the same supported document type.',
      'documentType'
    );
  }
}

/**
 * Validates taskWeightings transport shape when supplied.
 *
 * @param {*} taskWeightings - Candidate taskWeightings payload.
 */
function validateTaskWeightingsShape_(taskWeightings) {
  if (taskWeightings === undefined) {
    return;
  }

  if (!Array.isArray(taskWeightings)) {
    throwUpsertValidationError_('taskWeightings must be an array when provided.', 'taskWeightings');
  }

  taskWeightings.forEach((taskWeighting, index) => {
    if (!taskWeighting || typeof taskWeighting !== 'object' || Array.isArray(taskWeighting)) {
      throwUpsertValidationError_('taskWeightings entries must be objects.', 'taskWeightings');
    }

    if (!Object.hasOwn(taskWeighting, 'taskId')) {
      throwUpsertValidationError_(
        'taskWeightings entries must include taskId.',
        `taskWeightings[${index}].taskId`
      );
    }

    validateSafeTrimmedIdentifier_(taskWeighting.taskId, {
      throwValidationError: throwUpsertValidationError_,
      typeErrorMessage: 'taskWeightings.taskId must be a string.',
      nonEmptyErrorMessage: 'taskWeightings.taskId must be a non-empty string.',
      trimmedErrorMessage: 'taskWeightings.taskId must already be trimmed.',
      unsafeErrorMessage: 'taskWeightings.taskId contains unsafe characters.',
      fieldNames: {
        type: 'taskWeightings[' + index + '].taskId',
        nonEmpty: 'taskWeightings[' + index + '].taskId',
        trimmed: 'taskWeightings[' + index + '].taskId',
        unsafe: 'taskWeightings[' + index + '].taskId',
      },
    });

    if (!Object.hasOwn(taskWeighting, 'taskWeighting')) {
      throwUpsertValidationError_(
        'taskWeightings entries must include taskWeighting.',
        `taskWeightings[${index}].taskWeighting`
      );
    }
  });
}

/**
 * Validates required yearGroupKey shape for save-compatible upsert writes.
 *
 * @param {Object} parameters - Candidate payload.
 */
function validateRequiredYearGroupKey_(parameters) {
  if (!Object.hasOwn(parameters, 'yearGroupKey')) {
    throwUpsertValidationError_('Missing required field: yearGroupKey.', 'yearGroupKey');
  }

  if (parameters.yearGroupKey === null) {
    throwUpsertValidationError_(
      'yearGroupKey must be a non-null selected reference-data key.',
      'yearGroupKey'
    );
  }

  validateSafeTrimmedIdentifier_(parameters.yearGroupKey, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: 'yearGroupKey must be a string when provided.',
    nonEmptyErrorMessage: 'yearGroupKey must be a non-empty string.',
    trimmedErrorMessage: 'yearGroupKey must already be trimmed.',
    unsafeErrorMessage: 'yearGroupKey contains unsafe characters.',
    fieldNames: {
      type: 'yearGroupKey',
      nonEmpty: 'yearGroupKey',
      trimmed: 'yearGroupKey',
      unsafe: 'yearGroupKey',
    },
  });
}

/**
 * Extracts a supported Google document descriptor from a URL.
 *
 * @param {*} urlValue - Candidate URL string.
 * @param {string} fieldName - Source field name for diagnostics.
 * @returns {{documentId: string, documentType: string}} Parsed descriptor.
 */
function extractSupportedDocumentDescriptor_(urlValue, fieldName) {
  if (typeof urlValue !== 'string' || urlValue.trim().length === 0) {
    throwUpsertValidationError_(`${fieldName} must be a non-empty string URL.`, fieldName);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    throwUpsertValidationError_(`${fieldName} must be a valid URL.`, fieldName);
  }

  if (parsedUrl.hostname !== DOCS_URL_HOST) {
    throwUpsertValidationError_(`${fieldName} must target docs.google.com.`, fieldName);
  }

  const matchingPrefix = Object.keys(DOCUMENT_TYPE_BY_PATH_PREFIX).find((pathPrefix) =>
    parsedUrl.pathname.startsWith(pathPrefix)
  );

  if (!matchingPrefix) {
    throwUpsertValidationError_(
      `${fieldName} must reference a supported Google doc URL.`,
      fieldName
    );
  }

  const trailingPath = parsedUrl.pathname.slice(matchingPrefix.length);
  const documentId = trailingPath.split('/')[0];

  if (!documentId) {
    throwUpsertValidationError_(`${fieldName} must include a document id segment.`, fieldName);
  }

  let documentType = null;
  if (matchingPrefix === '/presentation/d/') {
    documentType = 'SLIDES';
  } else if (matchingPrefix === '/spreadsheets/d/') {
    documentType = 'SHEETS';
  }

  return {
    documentId,
    documentType,
  };
}

/**
 * Builds the controller upsert payload from transport parameters.
 *
 * @param {Object} parameters - Validated transport parameters.
 * @returns {Object} Controller payload.
 */
function buildControllerUpsertPayload_(parameters) {
  const shouldTranslateDocumentUrls =
    Object.hasOwn(parameters, 'referenceDocumentUrl') ||
    Object.hasOwn(parameters, 'templateDocumentUrl');

  if (!shouldTranslateDocumentUrls) {
    return parameters;
  }

  const referenceDescriptor = extractSupportedDocumentDescriptor_(
    parameters.referenceDocumentUrl,
    'referenceDocumentUrl'
  );
  const templateDescriptor = extractSupportedDocumentDescriptor_(
    parameters.templateDocumentUrl,
    'templateDocumentUrl'
  );

  const translatedPayload = {
    ...parameters,
    referenceDocumentId: referenceDescriptor.documentId,
    templateDocumentId: templateDescriptor.documentId,
    documentType: referenceDescriptor.documentType,
  };

  delete translatedPayload.referenceDocumentUrl;
  delete translatedPayload.templateDocumentUrl;

  return translatedPayload;
}

/**
 * Throws a transport validation error for assignment-definition read operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwReadValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'getAssignmentDefinition',
    fieldName,
  });
}

/**
 * Validates read parameters with strict safe-key requirements.
 *
 * @param {*} parameters - Candidate request parameters.
 * @returns {string} The validated definition key.
 */
function validateReadParameters_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throwReadValidationError_('params must be an object.', 'params');
  }

  if (!Object.hasOwn(parameters, 'definitionKey')) {
    throwReadValidationError_('Missing required field: definitionKey.', 'definitionKey');
  }

  validateSafeTrimmedIdentifier_(parameters.definitionKey, {
    throwValidationError: throwReadValidationError_,
    typeErrorMessage: 'definitionKey must be a string.',
    nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
    trimmedErrorMessage: 'definitionKey must already be trimmed.',
    unsafeErrorMessage: 'definitionKey contains unsafe characters.',
    fieldNames: {
      type: 'definitionKey',
      nonEmpty: 'definitionKey',
      trimmed: 'definitionKey',
      unsafe: 'definitionKey',
    },
  });

  return parameters.definitionKey;
}

/**
 * Validates that the input contains all required transport fields.
 *
 * @param {*} row - Candidate row.
 * @param {number} rowIndex - Candidate row index.
 * @throws {ApiValidationError} If the row shape is invalid.
 */
function validateRequiredFields_(row, rowIndex) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throwValidationError_(
      'Each assignment definition partial row must be an object.',
      null,
      rowIndex
    );
  }

  PARTIAL_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!Object.hasOwn(row, fieldName)) {
      throwValidationError_(`Missing required field: ${fieldName}.`, fieldName, rowIndex);
    }
  });
}

/**
 * Validates the strict definition-key transport contract.
 *
 * @param {*} definitionKey - Candidate definition key.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If definitionKey is missing, blank, or untrimmed.
 */
function validateDefinitionKey_(definitionKey, rowIndex) {
  if (typeof definitionKey !== 'string') {
    throwValidationError_('definitionKey must be a string.', 'definitionKey', rowIndex);
  }

  const trimmedDefinitionKey = definitionKey.trim();
  if (trimmedDefinitionKey.length === 0) {
    throwValidationError_('definitionKey must be a non-empty string.', 'definitionKey', rowIndex);
  }

  if (trimmedDefinitionKey !== definitionKey) {
    throwValidationError_('definitionKey must already be trimmed.', 'definitionKey', rowIndex);
  }
}

/**
 * Validates the strict primary-topic-key transport contract.
 *
 * @param {*} primaryTopicKey - Candidate topic key.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If primaryTopicKey is missing, blank, or untrimmed.
 */
function validatePrimaryTopicKey_(primaryTopicKey, rowIndex) {
  if (typeof primaryTopicKey !== 'string') {
    throwValidationError_('primaryTopicKey must be a string.', 'primaryTopicKey', rowIndex);
  }

  const trimmedPrimaryTopicKey = primaryTopicKey.trim();
  if (trimmedPrimaryTopicKey.length === 0) {
    throwValidationError_(
      'primaryTopicKey must be a non-empty string.',
      'primaryTopicKey',
      rowIndex
    );
  }

  if (trimmedPrimaryTopicKey !== primaryTopicKey) {
    throwValidationError_('primaryTopicKey must already be trimmed.', 'primaryTopicKey', rowIndex);
  }
}

/**
 * Checks whether a value is an ISO datetime string with timezone info.
 *
 * @param {*} value - Candidate timestamp value.
 * @returns {boolean} True when value is a valid ISO datetime string.
 */
function isIsoDateTimeString_(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [
    ,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
    timezone,
    sign,
    offsetHours,
    offsetMinutes,
  ] = match;

  const parsedOffsetHours = timezone === 'Z' ? 0 : Number(offsetHours);
  const parsedOffsetMinutes = timezone === 'Z' ? 0 : Number(offsetMinutes);
  if (parsedOffsetHours > MAX_OFFSET_HOURS || parsedOffsetMinutes > MAX_OFFSET_MINUTES) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const timezoneOffsetSign = timezone === 'Z' || sign === '+' ? 1 : NEGATIVE_TIMEZONE_MULTIPLIER;
  const timezoneOffsetMinutes =
    timezoneOffsetSign * (parsedOffsetHours * MINUTES_PER_HOUR + parsedOffsetMinutes);
  const localDate = new Date(
    parsedDate.getTime() + timezoneOffsetMinutes * MILLISECONDS_PER_MINUTE
  );

  return (
    localDate.getUTCFullYear() === Number(year) &&
    localDate.getUTCMonth() + 1 === Number(month) &&
    localDate.getUTCDate() === Number(day) &&
    localDate.getUTCHours() === Number(hours) &&
    localDate.getUTCMinutes() === Number(minutes) &&
    localDate.getUTCSeconds() === Number(seconds) &&
    localDate.getUTCMilliseconds() === Number(milliseconds)
  );
}

/**
 * Validates a timestamp transport field.
 *
 * @param {*} value - Candidate timestamp value.
 * @param {string} fieldName - Field name for diagnostics.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If value is not null and not a valid ISO datetime string.
 */
function validateTimestamp_(value, fieldName, rowIndex) {
  if (value === null) {
    return;
  }

  if (!isIsoDateTimeString_(value)) {
    throwValidationError_(
      `${fieldName} must be null or an ISO datetime string.`,
      fieldName,
      rowIndex
    );
  }
}

/**
 * Validates a single assignment-definition partial transport row.
 *
 * @param {*} row - Candidate row.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If the row violates the strict contract.
 */
function validatePartialRow_(row, rowIndex) {
  validateRequiredFields_(row, rowIndex);
  validateDefinitionKey_(row.definitionKey, rowIndex);
  validatePrimaryTopicKey_(row.primaryTopicKey, rowIndex);
  validateTimestamp_(row.createdAt, 'createdAt', rowIndex);
  validateTimestamp_(row.updatedAt, 'updatedAt', rowIndex);

  if (row.tasks !== null) {
    throwValidationError_('tasks must be null in partial transport.', 'tasks', rowIndex);
  }
}

/**
 * Builds a plain assignment-definition partial object.
 *
 * @param {Object} row - Valid partial row.
 * @returns {Object} Plain transport row.
 */
function toPlainPartialRow_(row) {
  return {
    primaryTitle: row.primaryTitle,
    primaryTopic: row.primaryTopic,
    primaryTopicKey: row.primaryTopicKey,
    yearGroup: row.yearGroup,
    alternateTitles: row.alternateTitles,
    alternateTopics: row.alternateTopics,
    documentType: row.documentType,
    referenceDocumentId: row.referenceDocumentId,
    templateDocumentId: row.templateDocumentId,
    assignmentWeighting: row.assignmentWeighting,
    definitionKey: row.definitionKey,
    tasks: row.tasks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Returns assignment-definition partial rows for API transport.
 *
 * @returns {Array<Object>} Plain assignment-definition partial rows.
 * @throws {ApiValidationError} If any row violates the strict transport contract.
 */
function getAssignmentDefinitionPartials_() {
  const partialRows = getAssignmentDefinitionController_().getAllPartialDefinitions();

  if (!Array.isArray(partialRows)) {
    throwValidationError_('Controller response must be an array.', RESPONSE_FIELD_NAME, 0);
  }

  return partialRows.map((row, rowIndex) => {
    validatePartialRow_(row, rowIndex);
    return toPlainPartialRow_(row);
  });
}

/**
 * Deletes an assignment definition by key after strict safety validation.
 *
 * @param {Object} parameters - Request payload containing definitionKey.
 */
function deleteAssignmentDefinition_(parameters) {
  const definitionKey = validateDeleteParameters_(parameters);
  getAssignmentDefinitionController_().deleteDefinitionByKey(definitionKey);
}

/**
 * Creates or updates an assignment definition through strict transport-boundary validation.
 *
 * @param {Object} parameters - Assignment-definition upsert payload.
 * @returns {AssignmentDefinition|Object} Persisted full definition payload.
 */
function upsertAssignmentDefinition_(parameters) {
  validateUpsertParameters_(parameters);
  return getAssignmentDefinitionController_().upsertDefinition(
    buildControllerUpsertPayload_(parameters)
  );
}

/**
 * Reads an assignment definition by key after strict safety validation.
 *
 * @param {Object} parameters - Request payload containing definitionKey.
 * @returns {AssignmentDefinition|Object|null} Retrieved definition payload.
 */
function getAssignmentDefinition_(parameters) {
  const definitionKey = validateReadParameters_(parameters);
  return getAssignmentDefinitionController_().getDefinitionByKey(definitionKey);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAssignmentDefinitionPartials_,
    getAssignmentDefinition_,
    deleteAssignmentDefinition_,
    upsertAssignmentDefinition_,
  };
}
