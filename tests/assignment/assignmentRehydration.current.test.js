/**
 * Current-format assignment rehydration: isolated raw-invalid submission items.
 *
 * Current regression coverage for current-format rehydration: a raw-invalid
 * item (known task key, known student identity) is replaced once
 * with a validation `CORRUPT_RECORD` placeholder carrying the exact catalogue
 * reasoning for all three criteria, validated before any constructor key/hash
 * fill, while healthy sibling items survive restoration unchanged. The
 * representation-mode regression verifies that a full read ignores an untrusted
 * stored partial mode while the explicit partial control retains score-only results.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
import { Assessment } from '#backend/Models/Assessment.js';
import {
  DOCUMENT_SUBMISSION_INDEX,
  HEAD_TASK_ID,
  KNOWN_TASK_IDS,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  corruptedRecord,
  corruptRecordAssessments,
  storedItemJson,
  expectCorruptRecordPlaceholder,
  expectSiblingIntact,
  focusDocumentSubmission,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('current-format rehydration of invalid raw submission items (full read)', () => {
  it('restores healthy canonical items unchanged', () => {
    const record = currentAssignmentJson();
    record.submissions = [record.submissions[2]];
    const restored = restoreAssignment(record);
    const submission = restored.submissions[0];
    expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    expect(submission.items[HEAD_TASK_ID].toJSON()).toEqual(
      storedItemJson(record, DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID)
    );
    expect(submission.items[SIBLING_TASK_ID].toJSON()).toEqual(
      storedItemJson(record, DOCUMENT_SUBMISSION_INDEX, SIBLING_TASK_ID)
    );
  });

  const invalidItemCases = [
    ['missing full content key', (item) => delete item.artifact.content],
    ['missing full contentHash key', (item) => delete item.artifact.contentHash],
    ['undefined full content value', (item) => (item.artifact.content = undefined)],
    ['malformed artifact record', (item) => (item.artifact = 'corrupt')],
    ['missing own taskId', (item) => delete item.taskId],
    ['extra criterion entry', (item) => (item.assessments.extra = { score: 5, reasoning: 'x' })],
    [
      'invalid catalogue cause',
      (item) =>
        (item.assessments.completeness = {
          score: 'E',
          reasoning: 'custom',
          error: { stage: 'assessment', code: 'NOT_IN_CATALOGUE' },
        }),
    ],
    [
      'non-record error cause',
      (item) =>
        (item.assessments.completeness = { score: 'E', reasoning: 'custom', error: 'corrupt' }),
    ],
    [
      'error result without reasoning',
      (item) =>
        (item.assessments.accuracy = {
          score: 'E',
          error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
        }),
    ],
  ];

  it.each(invalidItemCases)(
    'isolates %s as the exact catalogue CORRUPT_RECORD placeholder',
    (_label, mutate) => {
      const before = currentAssignmentJson();
      const siblingJson = storedItemJson(before, DOCUMENT_SUBMISSION_INDEX, SIBLING_TASK_ID);
      const record = corruptedRecord(DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID, mutate);
      const restored = restoreAssignment(record);
      const submission = restored.submissions[0];
      expectCorruptRecordPlaceholder(submission.items[HEAD_TASK_ID]);
      expectSiblingIntact(submission, siblingJson);
      expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
      expect(restored).toBeInstanceOf(Object);
      expect(Array.isArray(restored.submissions)).toBe(true);
    }
  );

  it('never fills content or hash on behalf of an invalid raw item', () => {
    const record = corruptedRecord(
      DOCUMENT_SUBMISSION_INDEX,
      HEAD_TASK_ID,
      (item) => delete item.artifact.contentHash
    );
    const restored = restoreAssignment(record);
    const placeholder = restored.submissions[0].items[HEAD_TASK_ID];
    expect(placeholder).toBeDefined();
    expect(placeholder.artifact.contentHash).toBeNull();
    expect(placeholder.artifact.content).toBeNull();
  });

  it('uses the full-read boundary instead of an untrusted stored representation mode', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    record.representationMode = 'partial';
    record._restorationMode = 'partial';
    const item = record.submissions[0].items[HEAD_TASK_ID];
    item.artifact.content = null;
    item.artifact.contentHash = null;
    item.assessments.completeness = { score: 4 };
    item.assessments.accuracy = { score: 3 };
    item.assessments.spag = { score: 'N' };
    const sibling = record.submissions[0].items[SIBLING_TASK_ID];
    sibling.assessments = {
      completeness: { score: 4, reasoning: 'Healthy sibling completeness evidence.' },
      accuracy: { score: 3, reasoning: 'Healthy sibling accuracy evidence.' },
      spag: { score: 'N', reasoning: 'Healthy sibling SPaG was not applicable.' },
    };
    const siblingJson = storedItemJson(record, 0, SIBLING_TASK_ID);

    // Default and explicit full calls must ignore the untrusted stored mode; the
    // independent partial control remains score-only under its explicit boundary.
    const defaultFull = restoreAssignment(structuredClone(record));
    const explicitFull = Assignment.fromJSON(structuredClone(record), 'full');
    for (const restored of [defaultFull, explicitFull]) {
      expect.soft(restored._restorationMode).toBe('full');
      const submission = restored.submissions[0];
      expect.soft(submission.items[HEAD_TASK_ID].assessments).toEqual(corruptRecordAssessments());
      expect.soft(submission.items[SIBLING_TASK_ID].assessments).toEqual(siblingJson.assessments);
      expect.soft(submission.items[SIBLING_TASK_ID].toJSON()).toEqual(siblingJson);
      expect.soft(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    }
    // The partial control must itself obey the partial wire contract: derive a
    // redacted snapshot from an independent clone rather than passing full
    // content/reasoning through the explicit partial restoration boundary.
    const partialRecord = rawPartialEmbeddedSnapshot(structuredClone(record));
    const validPartial = Assignment.fromJSON(partialRecord, 'partial');
    expect.soft(validPartial._restorationMode).toBe('partial');
    const partialSubmission = validPartial.submissions[0];
    expect.soft(partialSubmission.items[HEAD_TASK_ID].assessments).toEqual({
      completeness: { score: 4 },
      accuracy: { score: 3 },
      spag: { score: 'N' },
    });
    expect.soft(partialSubmission.items[SIBLING_TASK_ID].assessments).toEqual({
      completeness: { score: 4 },
      accuracy: { score: 3 },
      spag: { score: 'N' },
    });
    expect.soft(Object.keys(partialSubmission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
  });

  it('isolates a known store key paired with a mismatched item taskId at that key', () => {
    const before = currentAssignmentJson();
    const siblingJson = storedItemJson(before, DOCUMENT_SUBMISSION_INDEX, SIBLING_TASK_ID);
    const record = corruptedRecord(DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID, (item) => {
      item.taskId = SIBLING_TASK_ID;
    });
    const restored = restoreAssignment(record);
    const submission = restored.submissions[0];
    expectCorruptRecordPlaceholder(submission.items[HEAD_TASK_ID]);
    expectSiblingIntact(submission, siblingJson);
    expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
  });

  it('evaluates every result map against the exact catalogue copy including detached causes', () => {
    const record = corruptedRecord(DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID, (item) => {
      const inherited = Object.assign(
        Object.create({ stage: 'validation', code: 'CORRUPT_RECORD' })
      );
      item.assessments.completeness = { score: 'E', reasoning: 'custom', error: inherited };
    });
    const restored = restoreAssignment(record);
    expect(restored.submissions[0].items[HEAD_TASK_ID].assessments).toEqual(
      corruptRecordAssessments()
    );
  });
});
