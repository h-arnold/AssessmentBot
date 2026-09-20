/* global AssignmentDefinitionController, ApiValidationError, DateUtils, Validate, RESPONSE_FIELD_NAME, getAssignmentDefinitionController_, throwValidationError_, throwUpsertValidationError_, validatePartialRow_, validateSafeTrimmedIdentifier_, validateUpsertParameters_, validateDeleteParameters_, validateReadParameters_ */

const DOCS_URL_HOST = 'docs.google.com';
const DOCUMENT_TYPE_BY_PATH_PREFIX = Object.freeze({
  '/presentation/d/': 'SLIDES',
  '/spreadsheets/d/': 'SHEETS',
});

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

  // First validate URL format using Validate library
  if (!Validate.isValidUrl(urlValue)) {
    throwUpsertValidationError_(`${fieldName} must be a valid URL.`, fieldName);
  }

  // Parse for GAS V8 compatibility (no native URL class) - use string ops instead of regex
  const afterProtocol = urlValue.replace(/^https:\/\//iu, '');
  const NOT_FOUND = -1;
  const slashIndex = afterProtocol.indexOf('/');
  const hostname = (
    slashIndex === NOT_FOUND ? afterProtocol : afterProtocol.slice(0, slashIndex)
  ).toLowerCase();
  let pathname = slashIndex === NOT_FOUND ? '/' : afterProtocol.slice(slashIndex);
  // Strip query string and hash fragment
  const queryIndex = pathname.indexOf('?');
  const hashIndex = pathname.indexOf('#');
  const hasQuery = queryIndex !== NOT_FOUND;
  const hasHash = hashIndex !== NOT_FOUND;
  const endIndex = Math.min(
    hasQuery ? queryIndex : pathname.length,
    hasHash ? hashIndex : pathname.length
  );
  pathname = pathname.slice(0, endIndex);

  if (hostname !== DOCS_URL_HOST) {
    throwUpsertValidationError_(`${fieldName} must target docs.google.com.`, fieldName);
  }

  const matchingPrefix = Object.keys(DOCUMENT_TYPE_BY_PATH_PREFIX).find((pathPrefix) =>
    pathname.startsWith(pathPrefix)
  );

  if (!matchingPrefix) {
    throwUpsertValidationError_(
      `${fieldName} must reference a supported Google doc URL.`,
      fieldName
    );
  }

  const trailingPath = pathname.slice(matchingPrefix.length);
  const documentId = trailingPath.split('/')[0];

  if (!documentId) {
    throwUpsertValidationError_(`${fieldName} must include a document id segment.`, fieldName);
  }

  // Reject transport-unsafe identifiers before any Drive access. The URL path
  // segment is untrusted input; `..`, slashes, backslashes, untrimmed values,
  // and control characters must not reach the controller.
  validateSafeTrimmedIdentifier_(documentId, {
    throwValidationError: throwUpsertValidationError_,
    typeErrorMessage: `${fieldName} must include a document id segment.`,
    nonEmptyErrorMessage: `${fieldName} must include a document id segment.`,
    trimmedErrorMessage: `${fieldName} contains an unsafe document identifier.`,
    unsafeErrorMessage: `${fieldName} contains an unsafe document identifier.`,
    fieldNames: {
      type: fieldName,
      nonEmpty: fieldName,
      trimmed: fieldName,
      unsafe: fieldName,
    },
  });

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
 * Transport-boundary helper that serialises an AssignmentDefinition model instance
 * to a partial transport row, defensively stripping deprecated yearGroup field and
 * normalising Date fields to ISO strings.
 *
 * @param {Object} definition - AssignmentDefinition model instance or plain partial object.
 * @returns {Object} Plain transport partial row without yearGroup.
 * @remarks Calls `toPartialJSON()` on model instances so both model instances and plain objects are
 * accepted. Stripping `yearGroup` is a defensive safety net on top of the model-level removal in
 * favour of `yearGroupKey`. Date fields are normalised to ISO strings because `google.script.run`
 * prohibits live `Date` objects in return values.
 */
function toTransportPartialRow_(definition) {
  // If definition has toPartialJSON method, use it (model instance)
  const partial =
    typeof definition.toPartialJSON === 'function' ? definition.toPartialJSON() : definition;

  // Defensive strip yearGroup field (safety net in addition to model-level removal)
  const { yearGroup, ...rest } = partial;

  // Normalise Date fields to ISO strings via DateUtils (Date objects prohibited in google.script.run return values)
  return DateUtils.normaliseDateFields(rest, ['createdAt', 'updatedAt']);
}

/**
 * Returns assignment-definition partial rows for API transport.
 *
 * @returns {Array<Object>} Plain assignment-definition partial rows.
 * @throws {ApiValidationError} If the controller response is not an array, or if any row violates
 *   the strict partial-row contract enforced by `validatePartialRow_`.
 * @remarks Returned rows omit `yearGroup`, normalise Date fields to ISO strings, and carry a `tasks`
 * array of lightweight summaries. Every row is validated at the transport boundary so corrupt
 * registry data is rejected in production, not only in tests.
 */
function getAssignmentDefinitionPartials_() {
  const definitions = getAssignmentDefinitionController_().getAllPartialDefinitions();

  if (!Array.isArray(definitions)) {
    throwValidationError_('Controller response must be an array.', RESPONSE_FIELD_NAME, 0);
  }

  const rows = definitions.map((definition) => toTransportPartialRow_(definition));

  // Enforce the strict partial-row contract at the transport boundary so that
  // corrupt partial rows are caught in production, not just in tests.
  rows.forEach((row, index) => {
    validatePartialRow_(row, index);
  });

  return rows;
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
 * Stage-one create persists a definition with parsed tasks (tasks array in partial, keyed task objects in full store).
 * Final save persists metadata and weighting edits. Re-parse transport behaviour: when document URLs change,
 * existing task weightings are preserved for matching task IDs, and new tasks default to 1.
 * Duplicate detection uses the normalised (primaryTitle, primaryTopicKey, yearGroupKey) tuple.
 *
 * @param {Object} parameters - Assignment-definition upsert payload with primaryTitle, primaryTopicKey,
 *   referenceDocumentId/templateDocumentId (or referenceDocumentUrl/templateDocumentUrl for URL-based transport),
 *   optional definitionKey, yearGroupKey, assignmentWeighting, and taskWeightings. Recovery control
 *   fields `forceReparse` and `expectedDefinitionUpdatedAt` are accepted and validated at the transport boundary.
 * @returns {Object} Canonical full-definition response shape including resolved
 *   primaryTopic, primaryTopicKey, yearGroupKey, yearGroupLabel, full tasks array, and all metadata.
 *   This same shape is returned for stage-one create, final save, and document-change re-parse.
 * @remarks URL-shaped payloads are translated to document IDs before delegation. `assignmentWeighting`
 * is not defaulted here because the model owns that default. Response shaping delegates to
 * `controller.getFullAssignmentDefinition(definition)`.
 */
function upsertAssignmentDefinition_(parameters) {
  validateUpsertParameters_(parameters);
  const controller = getAssignmentDefinitionController_();

  // Inline URL-to-ID translation without assignmentWeighting defaulting
  const shouldTranslateDocumentUrls =
    Object.hasOwn(parameters, 'referenceDocumentUrl') ||
    Object.hasOwn(parameters, 'templateDocumentUrl');

  let payload = shouldTranslateDocumentUrls ? { ...parameters } : parameters;

  if (shouldTranslateDocumentUrls) {
    const referenceDescriptor = extractSupportedDocumentDescriptor_(
      parameters.referenceDocumentUrl,
      'referenceDocumentUrl'
    );
    const templateDescriptor = extractSupportedDocumentDescriptor_(
      parameters.templateDocumentUrl,
      'templateDocumentUrl'
    );

    payload = {
      ...parameters,
      referenceDocumentId: referenceDescriptor.documentId,
      templateDocumentId: templateDescriptor.documentId,
      documentType: referenceDescriptor.documentType,
    };

    delete payload.referenceDocumentUrl;
    delete payload.templateDocumentUrl;
  }

  const definition = controller.upsertDefinition(payload);
  const response = controller.getFullAssignmentDefinition(definition);
  return DateUtils.normaliseDateFields(response, ['createdAt', 'updatedAt']);
}

/**
 * Reads one full assignment definition by key after strict safety validation.
 *
 * Returns the canonical full-definition response shape, identical to upsertAssignmentDefinition response,
 * ensuring both read and write transports share the same editable entity contract.
 *
 * @param {Object} parameters - Request payload containing definitionKey (non-empty, already-trimmed string).
 * @returns {Object|null} Full definition with resolved primaryTopic, primaryTopicKey,
 *   yearGroupKey, yearGroupLabel, tasks array, and all metadata; null if not found.
 */
function getAssignmentDefinition_(parameters) {
  const definitionKey = validateReadParameters_(parameters);
  const controller = getAssignmentDefinitionController_();
  const definition = controller.getDefinitionByKey(definitionKey);
  if (!definition) {
    return null;
  }

  const response = controller.getFullAssignmentDefinition(definition);
  return DateUtils.normaliseDateFields(response, ['createdAt', 'updatedAt']);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toTransportPartialRow_,
    getAssignmentDefinitionPartials_,
    deleteAssignmentDefinition_,
    upsertAssignmentDefinition_,
    getAssignmentDefinition_,
    extractSupportedDocumentDescriptor_,
  };
}
