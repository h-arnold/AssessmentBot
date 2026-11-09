/**
 * Test-only derivation of linked legacy assignment scenarios from canonical
 * transport views.
 *
 * @remarks
 * The helper takes caller-supplied, already-loaded canonical views and returns
 * independent copies whose selected assignment carries the requested
 * assessment-contract marker on both its standalone full record and its
 * class-embedded partial. It never touches the filesystem, never imports the
 * loader or any generation code, and never mutates its inputs. Callers own
 * loading the views (for example through `loadSyntheticAnalysisProfile`) and
 * must pass the deep-frozen views as `sources`.
 *
 * This is a deterministic marker-only derivation: scores, identities,
 * artefacts, feedback and timestamps pass through unchanged from the canonical
 * data. It introduces no profile, view or model-input adapter.
 */

const MARKER = 'assessmentContractVersion';
const LEGACY_MARKER = 'legacy';
const STORED_VARIANT = 'stored';
const READ_VARIANT = 'read';
const SUPPORTED_VARIANTS = [STORED_VARIANT, READ_VARIANT];

/**
 * Validates the explicit variant selection.
 *
 * @param {unknown} variant Requested marker variant.
 * @returns {string} The validated variant name.
 * @throws {Error} When the variant is missing or unsupported.
 */
function resolveVariant(variant) {
  if (!SUPPORTED_VARIANTS.includes(variant)) {
    throw new Error(
      `Unsupported legacy scenario variant "${String(variant)}". Supported variants: ${SUPPORTED_VARIANTS.join(', ')}.`
    );
  }
  return variant;
}

/**
 * Applies the requested marker to a derived assignment record in place.
 *
 * @param {object} assignment Derived assignment copy.
 * @param {string} variant Validated variant name.
 * @returns {void}
 */
function applyMarker(assignment, variant) {
  if (variant === STORED_VARIANT) {
    Reflect.deleteProperty(assignment, MARKER);
    return;
  }
  Reflect.set(assignment, MARKER, LEGACY_MARKER);
}

/**
 * Finds the class view holding the selected assignment.
 *
 * @param {Record<string, object>} classesById Canonical class views keyed by class identifier.
 * @param {string} assignmentId Selected assignment identifier.
 * @param {string} profileName Committed profile the views were loaded from; used in the error message.
 * @returns {{classId: string, classView: object}} The owning class identifier and its canonical view.
 * @throws {Error} When no class view embeds the selected assignment.
 */
function resolveOwningClass(classesById, assignmentId, profileName) {
  for (const [classId, classView] of Object.entries(classesById)) {
    if (
      Array.isArray(classView.assignments) &&
      classView.assignments.some((assignment) => assignment.assignmentId === assignmentId)
    ) {
      return { classId, classView };
    }
  }
  throw new Error(
    `No canonical class view embeds assignment "${String(assignmentId)}" in profile "${String(profileName)}".`
  );
}

/**
 * Derives linked legacy forms of one selected assignment from canonical views.
 *
 * @param {object} config Derivation configuration.
 * @param {string} config.profileName Committed profile the views were loaded from; used in error messages.
 * @param {string} config.assignmentId Selected assignment identifier.
 * @param {string} config.variant Marker variant: `'stored'` removes the marker, `'read'` sets `'legacy'`.
 * @param {{classesById: Record<string, object>, assignmentsByKey: Record<string, object>}} config.sources Caller-supplied canonical transport views.
 * @returns {{classId: string, classView: object, assignmentsByKey: Record<string, object>, full: object, classEmbedded: object}} Derived scenario.
 * @throws {Error} When the variant or selected assignment is unsupported.
 */
export function deriveLegacyAssignmentScenario(config) {
  const { profileName, assignmentId, variant, sources } = config;
  const resolvedVariant = resolveVariant(variant);

  const assignmentsByKey = new Map(Object.entries(sources.assignmentsByKey));
  const canonicalFull = assignmentsByKey.get(assignmentId);
  if (!canonicalFull) {
    throw new Error(
      `No canonical assignment "${String(assignmentId)}" in profile "${String(profileName)}".`
    );
  }

  const { classId, classView } = resolveOwningClass(sources.classesById, assignmentId, profileName);

  const classViewCopy = structuredClone(classView);
  const assignmentsByKeyCopy = structuredClone(sources.assignmentsByKey);

  const classEmbedded = classViewCopy.assignments.find(
    (assignment) => assignment.assignmentId === assignmentId
  );
  const full = new Map(Object.entries(assignmentsByKeyCopy)).get(assignmentId);

  applyMarker(full, resolvedVariant);
  applyMarker(classEmbedded, resolvedVariant);

  return {
    classId,
    classView: classViewCopy,
    assignmentsByKey: assignmentsByKeyCopy,
    full,
    classEmbedded,
  };
}
