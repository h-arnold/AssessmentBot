/**
 * Shared fixtures for the `assignmentAssessment` Zod schema specs.
 *
 * Kept in a non-spec module so both `assignmentAssessment.zod.spec.ts` and
 * `assignmentAssessment.zod.regression.spec.ts` can import them without vitest
 * double-collecting the test files.
 *
 * `validFullAssignment` is the same frozen canonical record the task-preview
 * fixtures select (Slides `assignment-2-1` from the `small` profile), so the
 * schema suites parse a realistic transport payload instead of a schematic
 * one. Boundary probes clone it before mutating.
 *
 * `validBaseArtifact` stays a local schematic shape: it is the shared
 * null-content/null-contentHash boundary artefact that the submission, item
 * and regression cases deliberately probe. Deliberately invalid payloads stay
 * local to their owning specs.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

export { CANONICAL_SLIDES_ASSIGNMENT as validFullAssignment } from '../taskHeatmap/previewFixtures';

/** Local schematic artefact shared by the boundary cases of the schema suites. */
export const validBaseArtifact = {
  taskId: 'task-1',
  role: 'reference',
  pageId: 'page-1',
  documentId: 'doc-ref',
  uid: 'uid-1',
  type: 'TEXT' as const,
  content: null,
  contentHash: null,
  metadata: {},
};
