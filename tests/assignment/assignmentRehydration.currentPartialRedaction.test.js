/**
 * Current-format assignment rehydration: partial redaction contracts.
 *
 * Regression coverage originating in the Section 2 Red phase: the partial
 * restoration path (`Assignment.fromJSON(json, 'partial')`) is exercised
 * against raw marker-1 embedded partial snapshots composed independently of
 * the restoration owner (task summaries and redacted artefacts), alongside the
 * existing serialisation round trip. Numeric reasoning redaction and E reasoning
 * retention are covered with null-source preservation and no-hashing in the
 * implemented one-pass restoration path in `02_AssignmentRehydration.js`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_SUBMISSION_INDEX,
  NULL_DOCUMENT_SUBMISSION_INDEX,
  HEAD_TASK_ID,
  KNOWN_TASK_IDS,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  focusDocumentSubmission,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const CRITERIA = ['completeness', 'accuracy', 'spag'];

describe('current-format partial redaction during restoration round trips', () => {
  it('retains numeric reasoning on the full assignment and strips it in the partial round trip', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const full = restoreAssignment(record);
    expect(full.submissions[0].items[HEAD_TASK_ID].assessments.completeness.reasoning).toBe(
      'Canonical synthetic completeness evidence.'
    );
    const partial = full.toPartialJSON();
    for (const criterion of CRITERIA) {
      const entry = partial.submissions[0].items[HEAD_TASK_ID].assessments[criterion];
      expect(entry).toEqual({ score: expect.anything() });
      expect(entry).not.toHaveProperty('reasoning');
    }
  });

  it('retains failure reasoning and cause in the partial round trip of a null-document record', () => {
    const record = currentAssignmentJson();
    record.submissions = [record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX]];
    const partial = restoreAssignment(record).toPartialJSON();
    const entry = partial.submissions[0].items[HEAD_TASK_ID].assessments.completeness;
    expect(entry.score).toBe('E');
    expect(entry.reasoning).toBe('The submitted document could not be accessed.');
    expect(entry.error).toEqual({ stage: 'acquisition', code: 'SOURCE_UNREADABLE' });
  });

  it('restores a raw current marker-1 partial record without any hashing invocation', () => {
    const record = currentAssignmentJson();
    // Give the head item a real N beside its populated source before redacting.
    record.submissions[DOCUMENT_SUBMISSION_INDEX].items[HEAD_TASK_ID].assessments.spag = {
      score: 'N',
      reasoning: 'SPaG was not attempted for this task.',
    };
    const partialRecord = rawPartialEmbeddedSnapshot(record);
    expect(partialRecord.assessmentContractVersion).toBe(1);
    expect(partialRecord.assignmentDefinition.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: HEAD_TASK_ID, taskTitle: expect.any(String) }),
        expect.objectContaining({ taskId: SIBLING_TASK_ID, taskTitle: expect.any(String) }),
      ])
    );
    const hashSpy = vi.spyOn(
      require('#backend/Models/Artifacts/index.js').BaseTaskArtifact.prototype,
      'ensureHash'
    );
    const restored = restoreAssignment(partialRecord, 'partial');
    // Partial redaction is exempt from full-content consistency checks and must
    // never run the content-hashing seam, not merely end with null values.
    expect(hashSpy).not.toHaveBeenCalled();
    for (const [index, expectedTaskIds] of [
      [DOCUMENT_SUBMISSION_INDEX, KNOWN_TASK_IDS],
      [NULL_DOCUMENT_SUBMISSION_INDEX, KNOWN_TASK_IDS],
    ]) {
      const items = restored.submissions[index].items;
      expect(Object.keys(items).sort()).toEqual([...expectedTaskIds].sort());
      for (const taskKey of expectedTaskIds) {
        expect(items[taskKey].artifact.content).toBeNull();
        expect(items[taskKey].artifact.contentHash).toBeNull();
        expect(items[taskKey].taskId).toBe(taskKey);
      }
    }
    const documentItems = restored.submissions[DOCUMENT_SUBMISSION_INDEX].items;
    expect(documentItems[HEAD_TASK_ID].assessments.completeness).toEqual({ score: 4 });
    expect(documentItems[HEAD_TASK_ID].assessments.spag).toEqual({ score: 'N' });
    expect(documentItems[SIBLING_TASK_ID].assessments.accuracy).toEqual({ score: 5 });
    const nullItems = restored.submissions[NULL_DOCUMENT_SUBMISSION_INDEX].items;
    for (const taskKey of KNOWN_TASK_IDS) {
      const entry = nullItems[taskKey].assessments.completeness;
      expect(entry.score).toBe('E');
      expect(entry.reasoning).toBe('The submitted document could not be accessed.');
      expect(entry.error).toEqual({ stage: 'acquisition', code: 'SOURCE_UNREADABLE' });
    }
  });

  it('preserves explicit null base content and hash in restored null-document models', () => {
    const record = currentAssignmentJson();
    record.submissions = [record.submissions[NULL_DOCUMENT_SUBMISSION_INDEX]];
    for (const mode of [undefined, 'partial']) {
      const restored = restoreAssignment(record, mode);
      const artifact = restored.submissions[0].items[HEAD_TASK_ID].artifact;
      expect(artifact.content).toBeNull();
      expect(artifact.contentHash).toBeNull();
      expect(artifact.documentId).toBeNull();
    }
  });
});
