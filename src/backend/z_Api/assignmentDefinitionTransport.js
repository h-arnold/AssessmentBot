/* global AssignmentDefinitionController, ApiValidationError, DateUtils, Validate, RESPONSE_FIELD_NAME, getAssignmentDefinitionController_, throwValidationError_, throwUpsertValidationError_, validateUpsertParameters_, validateDeleteParameters_, validateReadParameters_ */

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
 * @remarks NEW helper per SPEC.md v1.9.0 Section 5, replacing the removed `toPlainPartialRow_`.
 * Provides defensive safety net by stripping `yearGroup` field (in addition to model-level removal in Section 1).
 * Normalises Date fields to ISO strings at the transport boundary. Works with both model instances
 * (calling `toPartialJSON()`) and plain objects. Exported for test accessibility.
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
 * @throws {ApiValidationError} If controller response is not an array.
 * @remarks Updated per SPEC.md v1.9.0 Section 5: now uses `toTransportPartialRow_` helper instead of
 * the removed `toPlainPartialRow_`. Returned objects will NO LONGER include the `yearGroup` field;
 * Date fields are normalised as ISO strings. Partial definitions have `tasks: null`.
 */
function getAssignmentDefinitionPartials_() {
  const definitions = getAssignmentDefinitionController_().getAllPartialDefinitions();

  if (!Array.isArray(definitions)) {
    throwValidationError_('Controller response must be an array.', RESPONSE_FIELD_NAME, 0);
  }

  return definitions.map((definition) => toTransportPartialRow_(definition));
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
 * Stage-one create persists a definition with parsed tasks (tasks: null in partial, full tasks in full store).
 * Final save persists metadata and weighting edits. Re-parse transport behaviour: when document URLs change,
 * existing task weightings are preserved for matching task IDs, and new tasks default to 1.
 * Duplicate detection uses the normalised (primaryTitle, primaryTopicKey, yearGroupKey) tuple.
 *
 * @param {Object} parameters - Assignment-definition upsert payload with primaryTitle, primaryTopicKey,
 *   referenceDocumentId/templateDocumentId (or referenceDocumentUrl/templateDocumentUrl for URL-based transport),
 *   optional definitionKey, yearGroupKey, assignmentWeighting, and taskWeightings.
 * @returns {Object} Canonical full-definition response shape including resolved
 *   primaryTopic, primaryTopicKey, yearGroupKey, yearGroupLabel, full tasks array, and all metadata.
 *   This same shape is returned for stage-one create, final save, and document-change re-parse.
 * @remarks Updated per SPEC.md v1.9.0 Section 5: URL-to-ID translation logic inlined from the removed
 * `buildControllerUpsertPayload_` helper. CRITICALLY, the inlined code does NOT apply `assignmentWeighting: 1`
 * defaulting (per validation ownership rules: model owns defaults, not API layer). Uses
 * `controller.toCanonicalFullDefinitionResponse(definition)` directly for response shaping.
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
  const response = controller.toCanonicalFullDefinitionResponse(definition);
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

  const response = controller.toCanonicalFullDefinitionResponse(definition);
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
