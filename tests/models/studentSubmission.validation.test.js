import { describe, expect, it, vi } from 'vitest';
const {
  StudentSubmission,
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/index.js');
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

function canonicalSubmission() {
  const assignments = Object.values(loadBackendModelInputs('small').assignmentsByKey);
  for (const assignment of assignments) {
    for (const source of assignment.submissions ?? []) {
      const taskId = Object.keys(source.items ?? {}).find((id) => {
        const artifact = source.items[id].artifact;
        return artifact?.type === 'TEXT' && artifact.content != null && artifact.contentHash;
      });
      if (taskId) {
        const raw = structuredClone(source);
        return { raw, taskId, artifact: raw.items[taskId].artifact };
      }
    }
  }
  throw new Error('Small canonical inputs contain no healthy TEXT submission.');
}

describe('StudentSubmission raw validation', () => {
  it('rejects non-record submissions, blank identities, and non-record items', () => {
    const { raw, taskId } = canonicalSubmission();
    expect(StudentSubmission.validateRaw(null, 'full')).toBe(false);
    expect(StudentSubmission.validateRaw([], 'full')).toBe(false);
    expect(StudentSubmission.validateRaw({ ...raw, studentId: '  ' }, 'full')).toBe(false);
    expect(StudentSubmission.validateRaw({ ...raw, assignmentId: '' }, 'full')).toBe(false);
    expect(StudentSubmission.validateRaw({ ...raw, items: { [taskId]: null } }, 'full')).toBe(
      false
    );
  });

  it('rejects malformed artifact fields and accepts null full content', () => {
    const { raw, taskId } = canonicalSubmission();
    const invalid = structuredClone(raw.items[taskId]);
    invalid.artifact.type = '';
    expect(StudentSubmissionItem.validateRaw(invalid, 'partial')).toBe(false);

    const nullBody = structuredClone(raw.items[taskId]);
    nullBody.artifact.content = null;
    nullBody.artifact.contentHash = null;
    expect(StudentSubmissionItem.validateRaw(nullBody, 'full')).toBe(true);
  });

  it('rejects invalid modes and non-record item containers even when empty', () => {
    const { raw } = canonicalSubmission();
    const empty = { ...raw, items: {} };
    expect(StudentSubmission.validateRaw(empty, 'invalid')).toBe(false);
    expect(StudentSubmission.validateRaw({ ...empty, items: [] }, 'full')).toBe(false);
  });

  it('rejects explicit null modes while preserving omitted-mode compatibility', () => {
    const { raw, taskId } = canonicalSubmission();
    const item = structuredClone(raw.items[taskId]);
    const empty = { ...raw, items: {} };

    expect(StudentSubmissionItem.validateRaw(item, null)).toBe(false);
    expect(() => StudentSubmissionItem.fromJSON(item, null)).toThrow();
    expect(StudentSubmission.validateRaw(raw, null)).toBe(false);
    expect(() => StudentSubmission.fromJSON(raw, null)).toThrow();
    expect(StudentSubmission.validateRaw(empty, null)).toBe(false);
    expect(() => StudentSubmission.fromJSON(empty, null)).toThrow();

    expect(StudentSubmissionItem.validateRaw(item)).toBe(true);
    expect(StudentSubmission.validateRaw(raw)).toBe(true);
  });

  it.each(['studentId', 'assignmentId'])('rejects non-string %s identities', (key) => {
    const { raw } = canonicalSubmission();
    expect(StudentSubmission.validateRaw({ ...raw, [key]: 42 }, 'full')).toBe(false);
  });

  it.each(['content', 'contentHash'])(
    'rejects own undefined full artifact %s while allowing explicit null in partial mode',
    (key) => {
      const { raw, taskId } = canonicalSubmission();
      const malformed = structuredClone(raw.items[taskId]);
      malformed.artifact[key] = undefined;
      expect(StudentSubmissionItem.validateRaw(malformed, 'full')).toBe(false);

      const redacted = structuredClone(raw.items[taskId]);
      redacted.artifact[key] = null;
      expect(StudentSubmissionItem.validateRaw(redacted, 'partial')).toBe(true);
    }
  );

  it('restores canonical submission data without mutating the input', () => {
    const { raw } = canonicalSubmission();
    const snapshot = structuredClone(raw);

    expect(StudentSubmission.validateRaw(raw, 'full')).toBe(true);
    expect(StudentSubmission.fromJSON(raw, 'full').toJSON()).toEqual(snapshot);
    expect(raw).toEqual(snapshot);
  });

  it.each(['content', 'contentHash'])('rejects full submission with missing %s', (key) => {
    const { raw, taskId, artifact } = canonicalSubmission();
    delete artifact[key];
    const rawItem = structuredClone(raw.items[taskId]);
    const rawSubmission = structuredClone(raw);

    expect(StudentSubmissionItem.validateRaw(rawItem, 'full')).toBe(false);
    expect(StudentSubmission.validateRaw(rawSubmission, 'full')).toBe(false);
    expect(() => StudentSubmission.fromJSON(rawSubmission, 'full')).toThrow();
    expect(() => StudentSubmissionItem.fromJSON(rawItem, 'full')).toThrow();
  });

  it.each(['content', 'contentHash'])('rejects item restoration with missing %s', (key) => {
    const { raw, taskId } = canonicalSubmission();
    const item = structuredClone(raw.items[taskId]);
    delete item.artifact[key];
    expect(StudentSubmissionItem.validateRaw(item, 'full')).toBe(false);
    expect(() => StudentSubmissionItem.fromJSON(item, 'full')).toThrow();
  });

  it.each(['omitted', 'null'])('restores %s redacted content without hashing', (redaction) => {
    const { raw, taskId } = canonicalSubmission();
    const partial = structuredClone(raw);
    const artifact = partial.items[taskId].artifact;
    if (redaction === 'omitted') {
      delete artifact.content;
      delete artifact.contentHash;
    } else {
      artifact.content = null;
      artifact.contentHash = null;
    }
    const ensureHash = vi.spyOn(
      Object.getPrototypeOf(StudentSubmission.fromJSON(raw).getItem(taskId).artifact),
      'ensureHash'
    );

    try {
      expect(StudentSubmission.validateRaw(partial, 'partial')).toBe(true);
      const restored = StudentSubmission.fromJSON(partial, 'partial').getItem(taskId).artifact;
      expect(ensureHash).not.toHaveBeenCalled();
      expect(restored.content).toBeNull();
      expect(restored.contentHash).toBeNull();
    } finally {
      ensureHash.mockRestore();
    }
  });

  it('allows incomplete full and partial round-trips while work is in flight', () => {
    const { raw } = canonicalSubmission();
    raw.items[Object.keys(raw.items)[0]].assessments = {};

    expect(StudentSubmission.fromJSON(raw, 'full').toJSON().items).toEqual(raw.items);
    const partial = StudentSubmission.fromJSON(raw, 'full').toPartialJSON();
    expect(StudentSubmission.fromJSON(partial, 'partial').toPartialJSON()).toEqual(partial);
  });

  it('restores redacted IMAGE partials without generating a hash', () => {
    const raw = {
      studentId: 'student-image',
      assignmentId: 'assignment-image',
      documentId: 'document-image',
      items: {
        imageTask: {
          taskId: 'imageTask',
          artifact: {
            type: 'IMAGE',
            role: 'submission',
            taskId: 'imageTask',
            source: null,
            metadata: {},
            content: null,
            contentHash: null,
          },
          assessments: {},
        },
      },
    };
    const ensureHash = vi.spyOn(
      Object.getPrototypeOf(
        StudentSubmission.fromJSON(raw, 'partial').getItem('imageTask').artifact
      ),
      'ensureHash'
    );
    try {
      const restored = StudentSubmission.fromJSON(raw, 'partial').getItem('imageTask').artifact;
      expect(ensureHash).not.toHaveBeenCalled();
      expect(restored.content).toBeNull();
      expect(restored.contentHash).toBeNull();
    } finally {
      ensureHash.mockRestore();
    }
  });

  it('round-trips partial E details while projecting numeric and N results to scores', () => {
    const { raw, taskId } = canonicalSubmission();
    raw.items[taskId].assessments = {
      completeness: {
        score: 'E',
        reasoning: 'Source unavailable',
        error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
      },
      accuracy: { score: 4, reasoning: 'Private numeric reasoning' },
      spag: { score: 'N', reasoning: 'Private N reasoning' },
    };
    const partial = StudentSubmission.fromJSON(raw, 'full').toPartialJSON();
    const restored = StudentSubmission.fromJSON(partial, 'partial').toPartialJSON();
    expect(restored.items[taskId].assessments).toEqual({
      completeness: {
        score: 'E',
        reasoning: 'Source unavailable',
        error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
      },
      accuracy: { score: 4 },
      spag: { score: 'N' },
    });
  });
});
