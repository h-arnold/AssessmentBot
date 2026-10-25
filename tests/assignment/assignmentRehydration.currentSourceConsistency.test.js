/**
 * Current-format assignment rehydration: null-source consistency and redaction.
 *
 * Regression coverage originating in the Section 2 Red phase: on a full read,
 * numeric/`N` results and assessment-stage failures beside a null submission
 * source contradict the stored record and are replaced with validation
 * `CORRUPT_RECORD` placeholders for all three criteria. Document-bearing
 * extraction E with a paired null content/hash is deliberately valid, as are
 * valid acquisition/validation causes beside a null source. Null-parent
 * acquisition/validation restrictions still apply: populated source fields
 * contradict that parent state. Partial redaction is exempt from the full-source
 * consistency check and never generates a content hash; explicit null
 * content/hash values are preserved in the models. This behaviour is
 * implemented in `02_AssignmentRehydration.js`.
 */

import { describe, expect, it } from 'vitest';
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
import { Assessment } from '#backend/Models/Assessment.js';
import {
  NULL_DOCUMENT_SUBMISSION_INDEX,
  HEAD_TASK_ID,
  SIBLING_TASK_ID,
  corruptRecordAssessments,
  corruptedRecord,
  currentAssignmentJson,
  DOCUMENT_SUBMISSION_INDEX,
  expectCorruptRecordPlaceholder,
  expectSiblingIntact,
  focusDocumentSubmission,
  KNOWN_TASK_IDS,
  restoreAssignment,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';

const CRITERIA = ['completeness', 'accuracy', 'spag'];

function assessmentEntriesAll(entryFactory) {
  return Object.fromEntries(
    CRITERIA.map((criterion, index) => [criterion, entryFactory(criterion, index)])
  );
}

function numericEntry(score) {
  return { score, reasoning: 'Canonical synthetic numeric evidence.' };
}

/** Marks the stored submission source artefact explicitly null (keys present). */
function makeStoredSourceExplicitlyNull(item) {
  item.artifact.content = null;
  item.artifact.contentHash = null;
}

/** Contradicting populated results straddling numeric marks and the 'N' marker. */
const contradictionRows = [
  ['numeric marks beside a null source', () => assessmentEntriesAll(() => numericEntry(4)), 4],
  [
    'an N marker beside a null source',
    () =>
      assessmentEntriesAll((criterion, index) =>
        index === CRITERIA.indexOf('spag')
          ? { score: 'N', reasoning: 'Recorded as not attempted.' }
          : numericEntry(2)
      ),
    'N',
  ],
  [
    'assessment-stage failures beside a null source',
    () =>
      assessmentEntriesAll(() => Assessment.createError('assessment', 'LLM_UNAVAILABLE').toJSON()),
    'E',
  ],
  [
    'extraction-stage failures beside a null source',
    () => assessmentEntriesAll(() => Assessment.createError('extraction', 'PARSE_FAILED').toJSON()),
    'E',
  ],
];

describe('current-format full read null-source consistency', () => {
  it.each(contradictionRows)(
    'replaces %s with catalogue CORRUPT_RECORD results for the offending item',
    (_label, buildAssessments, expectedRawSpagScore) => {
      const before = currentAssignmentJson();
      const siblingJson = structuredClone(
        before.submissions[NULL_DOCUMENT_SUBMISSION_INDEX].items[SIBLING_TASK_ID]
      );
      const record = corruptedRecord(NULL_DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID, (item) => {
        item.assessments = buildAssessments();
      });
      // Pre-restoration precondition: the raw record really carries the named
      // SPaG result type, so an N-hiding implementation cannot pass this row.
      const rawItem = record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX].items[HEAD_TASK_ID];
      expect(rawItem.assessments.spag.score).toBe(expectedRawSpagScore);
      const restored = restoreAssignment(record);
      const submission = restored.submissions.find((candidate) => candidate.documentId === null);
      expectCorruptRecordPlaceholder(submission.items[HEAD_TASK_ID]);
      expectSiblingIntact(submission, siblingJson);
      expect(Object.keys(submission.items).sort()).toEqual([HEAD_TASK_ID, SIBLING_TASK_ID]);
    }
  );

  it.each([
    [
      'acquisition failures',
      (item) => {
        item.assessments = assessmentEntriesAll(() =>
          Assessment.createError('acquisition', 'SOURCE_UNREADABLE').toJSON()
        );
      },
    ],
    [
      'validation failures',
      (item) => {
        item.assessments = assessmentEntriesAll(() =>
          Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON()
        );
      },
    ],
  ])('preserves explicit %s beside a null source without conversion', (_label, mutate) => {
    const record = corruptedRecord(NULL_DOCUMENT_SUBMISSION_INDEX, HEAD_TASK_ID, mutate);
    const storedMutantJson = structuredClone(record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX]);
    const restored = restoreAssignment(record);
    const submission = restored.submissions.find((candidate) => candidate.documentId === null);
    expect(submission.items[HEAD_TASK_ID].toJSON()).toEqual(storedMutantJson.items[HEAD_TASK_ID]);
    expect(submission.items[HEAD_TASK_ID].assessments).not.toEqual(corruptRecordAssessments());
  });

  it.each([
    [
      'acquisition failures beside a populated source stay valid',
      (item) => {
        item.assessments = assessmentEntriesAll(() =>
          Assessment.createError('acquisition', 'SOURCE_UNREADABLE').toJSON()
        );
      },
    ],
    [
      'validation failures beside a populated source stay valid',
      (item) => {
        item.assessments = assessmentEntriesAll(() =>
          Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON()
        );
      },
    ],
  ])(
    'preserves explicit %s on a document-bearing full record with an intact sibling',
    (_label, mutate) => {
      const record = currentAssignmentJson();
      focusDocumentSubmission(record);
      const siblingJson = structuredClone(record.submissions[0].items[SIBLING_TASK_ID]);
      mutate(record.submissions[0].items[HEAD_TASK_ID]);
      const storedMutantItem = structuredClone(record.submissions[0].items[HEAD_TASK_ID]);
      const restored = restoreAssignment(record);
      const submission = restored.submissions[0];
      expect(submission.items[HEAD_TASK_ID].toJSON()).toEqual(storedMutantItem);
      expect(submission.items[HEAD_TASK_ID].assessments).not.toEqual(corruptRecordAssessments());
      expectSiblingIntact(submission, siblingJson);
      expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    }
  );

  it.each(
    [
      ['numeric marks', () => assessmentEntriesAll(() => numericEntry(4)), 4],
      [
        'an N marker',
        () =>
          assessmentEntriesAll((criterion, index) =>
            index === CRITERIA.indexOf('spag')
              ? { score: 'N', reasoning: 'Recorded as not attempted.' }
              : numericEntry(2)
          ),
        'N',
      ],
      [
        'assessment-stage failures',
        () =>
          assessmentEntriesAll(() =>
            Assessment.createError('assessment', 'ASSESSMENT_FAILED').toJSON()
          ),
        'E',
      ],
    ].map((row) => [...row, makeStoredSourceExplicitlyNull])
  )(
    'replaces %s beside an explicitly null artefact source on a document-bearing full record with catalogue CORRUPT_RECORD results',
    (_label, buildAssessments, expectedRawSpagScore, mutateArtefact) => {
      const record = currentAssignmentJson();
      focusDocumentSubmission(record);
      const siblingJson = structuredClone(record.submissions[0].items[SIBLING_TASK_ID]);
      mutateArtefact(record.submissions[0].items[HEAD_TASK_ID]);
      record.submissions[0].items[HEAD_TASK_ID].assessments = buildAssessments();
      const rawItem = record.submissions[0].items[HEAD_TASK_ID];
      expect(rawItem.artifact.content).toBeNull();
      expect(rawItem.artifact.contentHash).toBeNull();
      expect(rawItem.assessments.spag.score).toBe(expectedRawSpagScore);
      const restored = restoreAssignment(record);
      const submission = restored.submissions[0];
      expectCorruptRecordPlaceholder(submission.items[HEAD_TASK_ID]);
      expectSiblingIntact(submission, siblingJson);
      expect(Object.keys(submission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
    }
  );

  it.each([
    ['acquisition', 'full', 'SOURCE_UNREADABLE', (record) => record],
    ['acquisition', 'partial', 'SOURCE_UNREADABLE', rawPartialEmbeddedSnapshot],
    ['validation', 'full', 'REASSESSMENT_REQUIRED', (record) => record],
    ['validation', 'partial', 'REASSESSMENT_REQUIRED', rawPartialEmbeddedSnapshot],
  ])(
    'rejects contradictory %s E for %s null-parent input',
    (stage, representation, code, compose) => {
      const record = currentAssignmentJson();
      const targetIndex = NULL_DOCUMENT_SUBMISSION_INDEX;
      const submission = record.submissions[targetIndex];
      const item = submission.items[HEAD_TASK_ID];
      const populatedArtifact = structuredClone(
        record.submissions[DOCUMENT_SUBMISSION_INDEX].items[HEAD_TASK_ID].artifact
      );
      item.artifact = { ...populatedArtifact, taskId: item.taskId };
      item.assessments = assessmentEntriesAll(() => Assessment.createError(stage, code).toJSON());
      const finalRecord = compose(record);
      const finalSubmission = finalRecord.submissions[targetIndex];
      const finalItem = finalSubmission.items[HEAD_TASK_ID];
      const siblingJson = structuredClone(finalSubmission.items[SIBLING_TASK_ID]);
      expect(finalSubmission.documentId).toBeNull();
      expect(finalItem.artifact.documentId).toEqual(expect.any(String));
      expect(finalItem.artifact.pageId).toEqual(expect.any(String));
      if (representation === 'partial') {
        expect(finalItem.artifact.content).toBeNull();
        expect(finalItem.artifact.contentHash).toBeNull();
      } else {
        expect(finalItem.artifact.content).toEqual(expect.any(String));
        expect(finalItem.artifact.contentHash).toEqual(expect.any(String));
      }
      expect(siblingJson.artifact.documentId).toBeNull();
      expect(siblingJson.artifact.pageId).toBeNull();
      expect(siblingJson.assessments).toEqual(
        assessmentEntriesAll(() =>
          Assessment.createError('acquisition', 'SOURCE_UNREADABLE').toJSON()
        )
      );
      const restored = restoreAssignment(
        finalRecord,
        representation === 'partial' ? 'partial' : undefined
      );
      const actualSubmission = restored.submissions[targetIndex];
      expect(actualSubmission.items[HEAD_TASK_ID].assessments).toEqual(corruptRecordAssessments());
      expect(actualSubmission.items[HEAD_TASK_ID].taskId).toBe(HEAD_TASK_ID);
      expect(actualSubmission.assignmentId).toBe(finalSubmission.assignmentId);
      expect(Object.keys(actualSubmission.items).sort()).toEqual([...KNOWN_TASK_IDS].sort());
      expectSiblingIntact(actualSubmission, siblingJson);
    }
  );
});
