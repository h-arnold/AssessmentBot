/* global extractSupportedDocumentDescriptor_, throwUpsertValidationError_, validateSafeTrimmedIdentifier_ */

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateUpsertParameters_,
    validateWizardUpsertParameters_,
    validateTaskWeightingsShape_,
    validateRequiredYearGroupKey_,
  };
}
