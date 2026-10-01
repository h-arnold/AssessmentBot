/**
 * Shared fixtures for the `assignmentAssessment` Zod schema specs.
 *
 * Kept in a non-spec module so both `assignmentAssessment.zod.spec.ts` and
 * `assignmentAssessment.zod.regression.spec.ts` can import them without vitest
 * double-collecting the test files.
 *
 * `validFullAssignment` selects the populated Slides `assignment-2-1` record
 * from the committed `small` synthetic profile and validates it through the
 * schema under test, so the schema suites parse a realistic transport payload
 * instead of a schematic one. It is deliberately deep-frozen: boundary probes
 * clone it (`structuredClone` or an explicit object spread) before mutating,
 * so a shared canonical record cannot drift between suites.
 *
 * `validBaseArtifact` stays a local schematic shape: it is the shared
 * null-content/null-contentHash boundary artefact that the submission, item
 * and regression cases deliberately probe. Deliberately invalid payloads stay
 * local to their owning specs.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import assignmentsByKeyRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentsByKey.json?raw';

import { AssignmentFullSchema } from './assignmentAssessment.zod';
import type { AssignmentFull } from './assignmentAssessment.zod';

/** Canonical populated Slides assignment selected from the `small` profile. */
const CANONICAL_ASSIGNMENT_ID = 'assignment-2-1';

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

/**
 * Deep-freeze a canonical fixture so an in-place mutation fails loudly instead
 * of leaking into another suite.
 *
 * @template T - Type of the value being frozen.
 * @param {T} value - The record to freeze.
 * @returns {T} The same record, with every reachable object frozen.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  for (const propertyValue of Object.values(value)) {
    deepFreeze(propertyValue);
  }
  return Object.freeze(value);
}

const assignmentsByKey = JSON.parse(assignmentsByKeyRaw) as Record<string, unknown>;

const canonicalAssignment = assignmentsByKey[CANONICAL_ASSIGNMENT_ID];
if (canonicalAssignment == null) {
  throw new Error(
    `assignmentAssessment.zod.fixtures: record "${CANONICAL_ASSIGNMENT_ID}" is absent from the small synthetic assignmentsByKey view.`
  );
}

/**
 * Canonical full assignment payload, validated against the schema under test
 * and deep-frozen so every boundary probe clones before it mutates.
 */
export const validFullAssignment: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(canonicalAssignment)
);
