import { describe, expect, it } from 'vitest';

import {
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import type { Target } from './syntheticAssessmentValidationSupport.js';
import { expectRule, assessmentCauseEntries } from './syntheticAssessmentValidationRules.js';

/**
 * Null-content placeholder hash-pair regression suite: on a document-bearing
 * submission, null artefact content requires exactly null contentHash —
 * arbitrary non-string values such as numbers, objects, booleans, or a deleted
 * key are not the required explicit null placeholder pair. Rows set both the
 * null-content state and a permitted extraction placeholder first, so each
 * rejection isolates the hash value only.
 */

/**
 * Switches one healthy document item to the null-content extraction placeholder.
 *
 * @param {Target} target Owner target with the mutated item.
 * @returns {void}
 */
function applyNullContentPlaceholder(target: Target) {
  const artefact = target.item.artifact as Record<string, unknown>;
  artefact.content = null;
  artefact.contentHash = null;
  target.item.assessments = assessmentCauseEntries('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
}

/** Malformed contentHash values beside null content (or `deleted`: absent key). */
const NULL_BODY_HASH_CORRUPTION_VALUES: Array<unknown> = [42, {}, false, undefined, 'deleted'];

/**
 * Runs the null-body hash matrix for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, healthyDocumentTarget: () => Target},
 * }} config Suite configuration.
 */
function runNullBodyHashMatrix(config: {
  describe: string;
  subject: () => { validate: () => void; healthyDocumentTarget: () => Target };
}) {
  describe(config.describe, () => {
    it('accepts the null-content placeholder with null contentHash beside a permitted cause', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      expect(target.submission.documentId).not.toBeNull();
      applyNullContentPlaceholder(target);
      expect((target.item.artifact as Record<string, unknown>).contentHash).toBeNull();
      expect(subject.validate).not.toThrow();
    });

    it.each(NULL_BODY_HASH_CORRUPTION_VALUES.map((value) => ({ value })))(
      'rejects the null-content placeholder with contentHash $value',
      ({ value }) => {
        const subject = config.subject();
        const target = subject.healthyDocumentTarget();
        applyNullContentPlaceholder(target);
        const artefact = target.item.artifact as Record<string, unknown>;
        if (value === 'deleted') delete artefact.contentHash;
        else artefact.contentHash = value;
        expectRule(subject.validate, 'contentHash', [String(target.item.taskId)]);
      }
    );
  });
}

runNullBodyHashMatrix({
  describe: 'persistence null-body placeholder hash boundary',
  subject: createPersistenceBoundary,
});

runNullBodyHashMatrix({
  describe: 'full transport null-body placeholder hash boundary',
  subject: createFullTransportBoundary,
});
