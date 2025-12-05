import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskDefinition } from '../../src/AdminSheet/Models/TaskDefinition.js';
import { StudentSubmission } from '../../src/AdminSheet/Models/StudentSubmission.js';
import { createMockABLogger } from '../helpers/mockFactories.js';

describe('StudentSubmission', () => {
  let mockABLogger;

  beforeEach(() => {
    // Mock ABLogger to capture warning calls
    mockABLogger = createMockABLogger(vi);
    global.ABLogger = {
      getInstance: () => mockABLogger,
    };
  });

  afterEach(() => {
    delete global.ABLogger;
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
});
