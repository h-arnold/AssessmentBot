/* global extractSupportedDocumentDescriptor_, isIsoDateTimeString_, throwUpsertValidationError_, validateSafeTrimmedIdentifier_ */

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

const PRIMARY_TOPIC_KEY_VALIDATION_MESSAGES = Object.freeze({
  typeErrorMessage: 'primaryTopicKey must be a string.',
  nonEmptyErrorMessage: 'primaryTopicKey must be a non-empty string.',
  trimmedErrorMessage: 'primaryTopicKey must already be trimmed.',
  unsafeErrorMessage: 'primaryTopicKey contains unsafe characters.',
});
const DEFINITION_KEY_VALIDATION_MESSAGES = Object.freeze({
  typeErrorMessage: 'definitionKey must be a string when provided.',
  nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
  trimmedErrorMessage: 'definitionKey must already be trimmed.',
  unsafeErrorMessage: 'definitionKey contains unsafe characters.',
});

/**
 * Validates the primary-topic identifier for an upsert payload.
 *
 * @param {Object} parameters - Candidate upsert payload.
 */
function validateUpsertPrimaryTopicKey_(parameters) {
  validateSafeTrimmedIdentifier_(parameters.primaryTopicKey, {
    throwValidationError: throwUpsertValidationError_,
    ...PRIMARY_TOPIC_KEY_VALIDATION_MESSAGES,
    fieldNames: {
      type: 'primaryTopicKey',
      nonEmpty: 'primaryTopicKey',
      trimmed: 'primaryTopicKey',
      unsafe: 'primaryTopicKey',
    },
  });
}

/**
 * Validates the optional definition identifier for an upsert payload.
 *
 * @param {Object} parameters - Candidate upsert payload.
 */
function validateUpsertOptionalDefinitionKey_(parameters) {
  if (Object.hasOwn(parameters, 'definitionKey') && parameters.definitionKey !== null) {
    validateSafeTrimmedIdentifier_(parameters.definitionKey, {
      throwValidationError: throwUpsertValidationError_,
      ...DEFINITION_KEY_VALIDATION_MESSAGES,
      fieldNames: {
        type: 'definitionKey',
        nonEmpty: 'definitionKey',
        trimmed: 'definitionKey',
        unsafe: 'definitionKey',
      },
    });
  }
}

/**
 * Validates recovery field shapes at the transport boundary.
 *
 * Type checks for transport/control fields live here per the validation
 * ownership rules; the mutual-exclusion business rule is domain-owned by
 * the upsert orchestrator. A supplied non-null baseline must be a strict
 * ISO datetime string with timezone; explicit null and omission retain
 * create-time/ordinary upsert behaviour.
 *
 * @param {*} parameters - Candidate request payload.
 * @throws {ApiValidationError} If a recovery field has an invalid shape.
 */
function validateRecoveryFieldShapes_(parameters) {
  if (
    Object.hasOwn(parameters, 'forceReparse') &&
    parameters.forceReparse !== undefined &&
    typeof parameters.forceReparse !== 'boolean'
  ) {
    throwUpsertValidationError_('forceReparse must be a boolean when provided.', 'forceReparse');
  }

  if (
    !Object.hasOwn(parameters, 'expectedDefinitionUpdatedAt') ||
    parameters.expectedDefinitionUpdatedAt === undefined ||
    parameters.expectedDefinitionUpdatedAt === null
  ) {
    return;
  }

  if (
    typeof parameters.expectedDefinitionUpdatedAt !== 'string' ||
    !isIsoDateTimeString_(parameters.expectedDefinitionUpdatedAt)
  ) {
    throwUpsertValidationError_(
      'expectedDefinitionUpdatedAt must be a strict ISO datetime string with timezone when provided.',
      'expectedDefinitionUpdatedAt'
    );
  }
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

  validateRecoveryFieldShapes_(parameters);

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

  validateUpsertPrimaryTopicKey_(parameters);

  validateSafeTrimmedIdentifier_(parameters.referenceDocumentId, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: 'referenceDocumentId must be a string.',
    nonEmptyErrorMessage: 'referenceDocumentId must be a non-empty string.',
    trimmedErrorMessage: 'referenceDocumentId must already be trimmed.',
    unsafeErrorMessage: 'referenceDocumentId contains unsafe characters.',
    fieldNames: {
      type: 'referenceDocumentId',
      nonEmpty: 'referenceDocumentId',
      trimmed: 'referenceDocumentId',
      unsafe: 'referenceDocumentId',
    },
  });

  validateSafeTrimmedIdentifier_(parameters.templateDocumentId, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: 'templateDocumentId must be a string.',
    nonEmptyErrorMessage: 'templateDocumentId must be a non-empty string.',
    trimmedErrorMessage: 'templateDocumentId must already be trimmed.',
    unsafeErrorMessage: 'templateDocumentId contains unsafe characters.',
    fieldNames: {
      type: 'templateDocumentId',
      nonEmpty: 'templateDocumentId',
      trimmed: 'templateDocumentId',
      unsafe: 'templateDocumentId',
    },
  });

  validateUpsertOptionalDefinitionKey_(parameters);

  validateTaskWeightingsShape_(parameters.taskWeightings);
  validateRequiredYearGroupKey_(parameters);
}

/**
 * Validates the wizard URL-style upsert transport payload.
 *
 * Recovery field shapes are validated once at the transport entry
 * (`validateUpsertParameters_`); this helper owns only the wizard shape.
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

  validateUpsertPrimaryTopicKey_(parameters);
  validateUpsertOptionalDefinitionKey_(parameters);

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateUpsertParameters_,
    validateWizardUpsertParameters_,
    validateTaskWeightingsShape_,
    validateRequiredYearGroupKey_,
    validateRecoveryFieldShapes_,
  };
}
