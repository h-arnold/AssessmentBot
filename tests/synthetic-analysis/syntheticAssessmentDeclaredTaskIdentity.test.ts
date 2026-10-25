import { describe, expect, it } from 'vitest';

import { readItemMap, requireArray, requireRecord } from './syntheticAssessmentContractSupport.js';
import { createPersistenceBoundary } from './syntheticAssessmentValidationOwners.js';

type RawRecord = Record<string, unknown>;
import { DECLARED_ITEM_IDENTITY_RULE } from './syntheticAssessmentRedRules.js';
import { expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Declared-task identity regression suite for persistence validation. Each row
 * mutates exactly one document item's `taskId` value while keeping its declared
 * map key, so the two corruption forms stay independent.
 */

/**
 * Finds a document-bearing submission owning at least two declared item keys.
 *
 * @param {RawRecord[]} assignments Persistence assignment records.
 * @returns {{item: Record<string, unknown>, itemKey: string, siblingKey: string, assignmentId: unknown}}
 *   The first two-item document submission target.
 */
function findTwoTaskDocumentSubmission(assignments: RawRecord[]) {
  for (const assignment of assignments) {
    const submissions = requireArray(assignment.submissions, 'submissions');
    for (const submissionRaw of submissions) {
      const submission = requireRecord(submissionRaw, 'submission');
      if (submission.documentId === null) continue;
      const itemMap = readItemMap(submission.items);
      const [firstKey, secondKey] = Object.keys(itemMap);
      if (secondKey === undefined) continue;
      return {
        item: itemMap[firstKey],
        itemKey: firstKey,
        siblingKey: secondKey,
        assignmentId: assignment.assignmentId,
      };
    }
  }
  throw new Error('Expected a document submission with at least two declared item keys.');
}

describe('persistence declared-task identity boundary', () => {
  it('accepts its canonical baseline with matching declared keys and item task identities', () => {
    const subject = createPersistenceBoundary();
    expect(subject.validate).not.toThrow();
  });

  it('rejects a declared item key whose item task value is unknown', () => {
    const subject = createPersistenceBoundary();
    const target = findTwoTaskDocumentSubmission(subject.assignments?.() ?? []);
    target.item.taskId = 'task-unknown';
    expectRule(subject.validate, DECLARED_ITEM_IDENTITY_RULE, [target.itemKey, 'task-unknown']);
  });

  it('rejects a declared item key whose item task value names a different declared task', () => {
    const subject = createPersistenceBoundary();
    const target = findTwoTaskDocumentSubmission(subject.assignments?.() ?? []);
    expect(target.siblingKey).not.toBe(target.itemKey);
    target.item.taskId = target.siblingKey;
    expectRule(subject.validate, DECLARED_ITEM_IDENTITY_RULE, [target.itemKey, target.siblingKey]);
  });
});
