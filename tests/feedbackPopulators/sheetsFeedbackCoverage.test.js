import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SheetsFeedback from '../../src/backend/FeedbackPopulators/SheetsFeedback.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Focused hermetic branch coverage for SheetsFeedback submission handling:
// missing documents, page-less items, both feedback shapes and the
// empty-batch outcome.
describe('SheetsFeedback coverage behaviour', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;
  let batchUpdates;

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    mockTracker = { updateProgress: vi.fn(), logError: vi.fn() };
    batchUpdates = [];
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
      BatchUpdateUtility: () => ({
        executeMultipleBatchUpdates: vi.fn((updates) => batchUpdates.push(...updates)),
      }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('handles empty submissions without batch execution', () => {
    new SheetsFeedback(null).applyFeedback();
    expect(mockTracker.updateProgress).toHaveBeenCalledWith(
      'No spreadsheet feedback to apply.',
      false
    );
  });

  it('warns on submissions without documents, including unknown students', () => {
    new SheetsFeedback([null, { studentId: 's-one' }, {}]).applyFeedback();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing submission or document ID')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
  });

  it('applies feedback for labelled students with batch requests', () => {
    const feedback = {
      getItems: () => [{ location: [0, 1], status: 'correct' }],
    };
    const submissions = [
      {
        documentId: 'sheet-doc',
        student: { name: 'Student One' },
        items: {
          task_one: {
            taskId: 'task-one',
            artifact: { pageId: 11 },
            feedback: { cellReference: true },
            getFeedback: () => feedback,
          },
        },
      },
    ];
    new SheetsFeedback(submissions).applyFeedback();
    expect(batchUpdates).toHaveLength(1);
    expect(batchUpdates[0].spreadsheetId).toBe('sheet-doc');
    expect(mockTracker.updateProgress).toHaveBeenCalledWith(
      expect.stringContaining('Applied cell colour feedback'),
      false
    );
  });

  it('covers page-less items, legacy feedback shapes and falsy requests', () => {
    const populator = new SheetsFeedback([]);
    const warnSpy = mockLogger.warn;
    const requests = populator.generateBatchRequestsForSubmission({
      items: {
        noFeedback: { taskId: 'task-one', artifact: { pageId: 1 } },
        noPage: { taskId: 'task-nopage', artifact: {}, feedback: {} },
        legacy: {
          taskId: 'task-two',
          artifact: { pageId: 2 },
          feedback: { cellReference: { items: [{ location: [], status: 'incorrect' }] } },
        },
        notArray: {
          taskId: 'task-three',
          artifact: { pageId: 3 },
          feedback: { cellReference: { items: 'not-an-array' } },
        },
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('without pageId'));
    expect(requests).toHaveLength(1);

    const nullRequestPopulator = new SheetsFeedback([]);
    nullRequestPopulator.createCellFormatRequest = () => null;
    expect(
      nullRequestPopulator.generateBatchRequestsForSubmission({
        items: {
          task_one: {
            taskId: 'task-one',
            artifact: { pageId: 4 },
            feedback: { cellReference: true },
            getFeedback: () => ({ getItems: () => [{ location: [1, 1], status: 'correct' }] }),
          },
        },
      })
    ).toEqual([]);
  });

  it('formats cells for every status including the default', () => {
    const populator = new SheetsFeedback([]);
    expect(populator.getFormatForStatus('correct').backgroundColor.green).toBeCloseTo(0.84, 2);
    expect(populator.getFormatForStatus('incorrect').backgroundColor.red).toBeGreaterThan(0.9);
    expect(populator.getFormatForStatus('notAttempted').backgroundColor.red).toBe(1);
    expect(populator.getFormatForStatus('unknown').backgroundColor.green).toBe(1);
    const request = populator.createCellFormatRequest(2, 3, 'correct', 9);
    expect(request.repeatCell.range).toMatchObject({
      sheetId: 9,
      startRowIndex: 2,
      endRowIndex: 3,
      startColumnIndex: 3,
      endColumnIndex: 4,
    });
  });
});
