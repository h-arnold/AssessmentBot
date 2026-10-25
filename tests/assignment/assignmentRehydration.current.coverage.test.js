/**
 * Current-format assignment rehydration: completed-item coverage materialisation.
 *
 * Regression coverage originating in the Section 2 Red phase: during a
 * one-pass full or partial restoration, a known task missing from an
 * identified, otherwise trustworthy submission is materialised once as a
 * validation `CORRUPT_RECORD` placeholder from the assignment's own embedded
 * definition snapshot. Genuine no-submission null-parent records stay empty,
 * and explicit acquisition placeholders survive untouched. This behaviour is
 * implemented in `02_AssignmentRehydration.js`.
 */

import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_SUBMISSION_INDEX,
  NULL_DOCUMENT_SUBMISSION_INDEX,
  HEAD_TASK_ID,
  KNOWN_TASK_IDS,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  storedItemJson,
  expectCorruptRecordPlaceholder,
  focusDocumentSubmission,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

const RESTORE_MODES = ['full', 'partial'];

/**
 * Builds the mode-appropriate raw record: the full canonical record for full
 * restoration, or a raw marker-1 embedded partial snapshot (task summaries and
 * redacted artefacts) composed independently of the restoration owner.
 *
 * @param {'full'|'partial'} mode Restoration mode.
 * @returns {Record<string, unknown>} Raw record for the mode.
 */
function recordForMode(mode) {
  const record = currentAssignmentJson();
  focusDocumentSubmission(record);
  return mode === 'partial' ? rawPartialEmbeddedSnapshot(record) : record;
}

describe('completed-item coverage materialisation during restoration', () => {
  it.each(RESTORE_MODES)(
    'materialises the catalogue placeholder for a missing known task during %s restoration',
    (mode) => {
      const before = currentAssignmentJson();
      const healthyJson = storedItemJson(before, DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID);
      const record = recordForMode(mode);
      delete record.submissions[0].items[SIBLING_TASK_ID];
      const restored = restoreAssignment(record, mode);
      const submission = restored.submissions[0];
      expectCorruptRecordPlaceholder(submission.items[SIBLING_TASK_ID]);
      const healthyItem = submission.items[HEAD_TASK_ID];
      expect(healthyItem.assessments.completeness.score).toBe(4);
      if (mode === 'full') {
        expect(healthyItem.toJSON()).toEqual(healthyJson);
      }
      expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    }
  );

  it.each(RESTORE_MODES)(
    'materialises the placeholder for every known task when a document-bearing submission has empty items during %s restoration',
    (mode) => {
      const record = recordForMode(mode);
      record.submissions[0] = {
        ...record.submissions[0],
        items: {},
      };
      const restored = restoreAssignment(record, mode);
      const items = restored.submissions[0].items;
      expect(Object.keys(items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
      for (const taskId of KNOWN_TASK_IDS) expectCorruptRecordPlaceholder(items[taskId]);
    }
  );

  it.each(RESTORE_MODES)(
    'materialises the placeholder for every known task when the stored item collection is corrupt during %s restoration',
    (mode) => {
      const record = recordForMode(mode);
      record.submissions[0] = {
        ...record.submissions[0],
        items: [],
      };
      const restored = restoreAssignment(record, mode);
      const items = restored.submissions[0].items;
      expect(Object.keys(items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
      for (const taskId of KNOWN_TASK_IDS) expectCorruptRecordPlaceholder(items[taskId]);
    }
  );

  it('keeps a genuine no-submission null-parent record empty without placeholders', () => {
    const record = currentAssignmentJson();
    record.submissions = [
      {
        ...record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX],
        items: {},
      },
    ];
    const restored = restoreAssignment(record);
    expect(restored.submissions).toHaveLength(1);
    expect(restored.submissions[0].items).toEqual({});
  });

  it('keeps explicit null-document acquisition placeholders exactly as stored', () => {
    const record = currentAssignmentJson();
    record.submissions = [record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX]];
    const canonicalNullItems = record.submissions[0].items;
    const restored = restoreAssignment(record);
    const submission = restored.submissions[0];
    expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    for (const taskId of KNOWN_TASK_IDS) {
      expect(submission.items[taskId].toJSON()).toEqual(canonicalNullItems[taskId]);
      expect(submission.items[taskId].assessments.completeness.error).toEqual({
        stage: 'acquisition',
        code: 'SOURCE_UNREADABLE',
      });
    }
  });

  it('preserves sibling acquisition placeholders when one null-document item is raw-invalid', () => {
    const record = currentAssignmentJson();
    record.submissions = [record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX]];
    const beforeNullSibling = structuredClone(record.submissions[0].items[SIBLING_TASK_ID]);
    delete record.submissions[0].items[HEAD_TASK_ID].taskId;
    const restored = restoreAssignment(record);
    const submission = restored.submissions[0];
    expectCorruptRecordPlaceholder(submission.items[HEAD_TASK_ID]);
    expect(submission.items[SIBLING_TASK_ID].toJSON()).toEqual(beforeNullSibling);
    expect(submission.items[SIBLING_TASK_ID].assessments.completeness.error).toEqual({
      stage: 'acquisition',
      code: 'SOURCE_UNREADABLE',
    });
  });
});
