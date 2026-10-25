import { CRITERIA } from './syntheticAssessmentContractSupport.js';

/**
 * Rule markers owned by the Section-2a red regression suites.
 *
 * @remarks
 * Each marker names the boundary the future validator change must report, per
 * the companion review; wording of the surrounding message stays free. The
 * null-content hash rows reuse the established `contentHash` marker from
 * `syntheticAssessmentValidationRules.js`.
 */

/** The failure must report the current-format assessment contract marker. */
export const MARKER_RULE = 'assessmentContractVersion';
/** The failure must report a submission item's declared-task identity mismatch. */
export const DECLARED_ITEM_IDENTITY_RULE = 'declared task';
/** The failure must report a populated null-document artefact metadata map. */
export const NULL_PARENT_METADATA_RULE = 'null-document metadata';
/** The failure must report a populated null-document item feedback map. */
export const NULL_PARENT_FEEDBACK_RULE = 'null-document feedback';
/**
 * The failure must report a null-document artefact missing one of its required
 * explicit-null full source keys, or carrying a non-null value beneath them.
 */
export const NULL_PARENT_SOURCE_FIELD_RULE = 'null-document artefact field';
/** The failure must report a null-document artefact whose type is not the pinned base placeholder. */
export const NULL_PARENT_ARTIFACT_TYPE_RULE = 'null-document artefact type';
/** The failure must report a null-document artefact whose role is not the pinned submission role. */
export const NULL_PARENT_ARTIFACT_ROLE_RULE = 'null-document artefact role';
