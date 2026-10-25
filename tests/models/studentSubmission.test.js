import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TaskDefinition } from '#backend/Models/TaskDefinition.js';
const {
  StudentSubmission,
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/index.js');
import { createMockABLogger } from '../helpers/mockFactories.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

describe('StudentSubmission', () => {
  let mockABLogger;
  let restoreGlobals;

  beforeEach(() => {
    // Mock ABLogger to capture warning calls
    mockABLogger = createMockABLogger(vi);
    ({ restore: restoreGlobals } = withGlobalMocks({
      ABLogger: {
        getInstance: () => mockABLogger,
      },
    }));
  });

  afterEach(() => {
    restoreGlobals();
  });

  it('exposes both model classes as Node globals in item-before-submission setup order', () => {
    const setup = require('../setupGlobals.js');
    const setupSource = readFileSync(
      fileURLToPath(new URL('../setupGlobals.js', import.meta.url)),
      'utf8'
    );
    const itemLoadIndex = setupSource.indexOf(
      "require('../src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js')"
    );
    const submissionLoadIndex = setupSource.indexOf(
      "require('../src/backend/Models/StudentSubmission/index.js')"
    );
    const itemGlobalIndex = setupSource.indexOf('g.StudentSubmissionItem = StudentSubmissionItem;');
    const submissionGlobalIndex = setupSource.indexOf('g.StudentSubmission = StudentSubmission;');

    expect(setup).toBeDefined();
    expect(itemLoadIndex).toBeGreaterThanOrEqual(0);
    expect(submissionLoadIndex).toBeGreaterThan(itemLoadIndex);
    expect(itemGlobalIndex).toBeGreaterThanOrEqual(0);
    expect(submissionGlobalIndex).toBeGreaterThan(itemGlobalIndex);
    expect(globalThis.StudentSubmissionItem).toBe(StudentSubmissionItem);
    expect(globalThis.StudentSubmission).toBe(StudentSubmission);
  });

  it('upserts items and round-trips JSON', () => {
    const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
    td.addReferenceArtifact({ type: 'text', content: 'Reference' });
    td.addTemplateArtifact({ type: 'text', content: '' });
    const sub = new StudentSubmission('stu1', 'assign1', 'doc1', 'Student One');
    sub.upsertItemFromExtraction(td, { content: ' Student response ' });
    const item = sub.getItem(td.getId());
    expect(item.artifact.content).toBe('Student response');
    const restored = StudentSubmission.fromJSON(sub.toJSON());
    expect(restored.getItem(td.getId()).artifact.content).toBe('Student response');
  });

  it('should NOT warn for IMAGE artifacts with null content', () => {
    // Setup: Create a task definition with IMAGE type reference
    const td = new TaskDefinition({ taskTitle: 'Image Task', pageId: 'p1', index: 0 });
    td.addReferenceArtifact({ type: 'IMAGE', content: null });

    // Create submission with null content (typical before image extraction)
    const sub = new StudentSubmission('stu2', 'assign2', 'doc2', 'Student Two');
    sub.upsertItemFromExtraction(td, { content: null });

    // Assert: Should NOT have called warn for IMAGE type
    expect(mockABLogger.warn).not.toHaveBeenCalled();
  });

  it('should warn for TEXT artifacts with null content', () => {
    // Setup: Create a TEXT task definition
    const td = new TaskDefinition({ taskTitle: 'Text Task', pageId: 'p3', index: 2 });
    td.addReferenceArtifact({ type: 'TEXT', content: 'Reference text' });

    // Create submission with null content (student deleted their tag)
    const sub = new StudentSubmission('stu3', 'assign3', 'doc3', 'Student Three');
    sub.upsertItemFromExtraction(td, { content: null });

    // Assert: Should warn for TEXT type with null content
    expect(mockABLogger.warn).toHaveBeenCalledOnce();
    expect(mockABLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No content found for Student Three')
    );
  });

  it('propagates documentId to created artifacts (fallback to parent submission)', () => {
    const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
    td.addReferenceArtifact({ type: 'TEXT', content: 'Reference' });
    const sub = new StudentSubmission('stu1', 'assign1', 'doc-parent', 'Student One');
    // Call upsert without documentId in extraction; artifact should pick parent's documentId
    sub.upsertItemFromExtraction(td, { content: 'Student answer' });
    const item = sub.getItem(td.getId());
    expect(item.artifact.documentId).toBe('doc-parent');
  });

  it('uses extraction.documentId if provided when creating artifact', () => {
    const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
    td.addReferenceArtifact({ type: 'TEXT', content: 'Reference' });
    const sub = new StudentSubmission('stu2', 'assign2', 'doc-parent', 'Student Two');
    // extraction provides an explicit documentId (e.g., parser discovered doc id)
    sub.upsertItemFromExtraction(td, { content: 'Student answer', documentId: 'doc-extraction' });
    const item = sub.getItem(td.getId());
    expect(item.artifact.documentId).toBe('doc-extraction');
  });

  it('replaces all criterion results atomically when a task fails', () => {
    const canonical = loadBackendModelInputs('small');
    const assignment = Object.values(canonical.assignmentsByKey).find(
      (row) => row.submissions?.length
    );
    const source = assignment.submissions.find((row) =>
      Object.values(row.items ?? {}).some(
        (item) =>
          item.artifact?.type === 'TEXT' &&
          item.artifact.content != null &&
          item.assessments &&
          Object.keys(item.assessments).length
      )
    );
    const taskId = Object.keys(source.items).find(
      (id) =>
        source.items[id].artifact?.type === 'TEXT' &&
        source.items[id].artifact.content != null &&
        Object.keys(source.items[id].assessments ?? {}).length
    );
    const rawSubmission = structuredClone(source);
    const rawItem = rawSubmission.items[taskId];
    const sub = StudentSubmission.fromJSON({
      ...rawSubmission,
      assignmentId: assignment.assignmentId,
    });
    const item = sub.getItem(taskId);
    item.assessments = {
      ...item.assessments,
      stale: { score: 'N' },
      obsolete: { score: 3, reasoning: 'old' },
      notApplicable: { score: 'N' },
    };
    item.addAssessment('completeness', { score: 5, reasoning: 'Previously complete' });
    item.addAssessment('accuracy', { score: 4, reasoning: 'Previously accurate' });
    item.addAssessment('spag', { score: 3, reasoning: 'Previously polished' });
    item.addFeedback('summary', { text: 'Old feedback' });

    item.setError('assessment', 'LLM_UNAVAILABLE');

    expect(item.getAssessment()).toEqual({
      completeness: {
        score: 'E',
        reasoning: 'The assessment service could not complete the request after retries.',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      },
      accuracy: {
        score: 'E',
        reasoning: 'The assessment service could not complete the request after retries.',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      },
      spag: {
        score: 'E',
        reasoning: 'The assessment service could not complete the request after retries.',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      },
    });
    expect(item.getFeedback()).toEqual({});
    expect(Object.keys(item.getAssessment())).toEqual(['completeness', 'accuracy', 'spag']);
    expect(item.artifact.content).toBe(rawItem.artifact.content);
    expect(item.artifact.contentHash).toBe(rawItem.artifact.contentHash);
  });

  it('preserves partial error detail while keeping numeric and N results score-only', () => {
    const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
    td.addReferenceArtifact({ type: 'TEXT', content: 'Reference' });
    const sub = new StudentSubmission('stu1', 'assign1', 'doc1', 'Student One');
    const item = sub.upsertItemFromExtraction(td, { content: 'Student answer' });
    item.addAssessment('completeness', {
      score: 'E',
      reasoning: 'The source could not be read',
      error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
    });
    item.addAssessment('accuracy', { score: 4, reasoning: 'Good' });
    item.addAssessment('spag', { score: 'N', reasoning: 'Not applicable' });

    expect(item.toPartialJSON().assessments).toEqual({
      completeness: {
        score: 'E',
        reasoning: 'The source could not be read',
        error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
      },
      accuracy: { score: 4 },
      spag: { score: 'N' },
    });
  });

  it('permits incomplete assessment maps while a task is in flight', () => {
    const assignment = Object.values(loadBackendModelInputs('small').assignmentsByKey).find(
      (row) => row.submissions?.length
    );
    const source = assignment.submissions.find((row) =>
      Object.values(row.items ?? {}).some(
        (item) => item.artifact?.type === 'TEXT' && item.artifact.content != null
      )
    );
    const taskId = Object.keys(source.items).find(
      (id) =>
        source.items[id].artifact?.type === 'TEXT' && source.items[id].artifact.content != null
    );
    const raw = structuredClone(source);
    const sub = StudentSubmission.fromJSON({ ...raw, assignmentId: assignment.assignmentId });
    const item = sub.getItem(taskId);
    item.assessments = {};
    item.addAssessment('completeness', { score: 4, reasoning: 'In progress' });
    expect(Object.keys(item.getAssessment())).toEqual(['completeness']);
  });

  it('rejects incomplete submission identity and missing task definitions', () => {
    expect(() => new StudentSubmission('', 'assignment')).toThrow(
      'StudentSubmission requires studentId & assignmentId'
    );
    expect(() => new StudentSubmission('student', '')).toThrow(
      'StudentSubmission requires studentId & assignmentId'
    );
    const submission = new StudentSubmission('student', 'assignment');
    expect(() => submission.upsertItemFromExtraction()).toThrow(
      'upsertItemFromExtraction requires taskDefinition'
    );
  });
});
