import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SheetsFeedback from '../../src/backend/FeedbackPopulators/SheetsFeedback.js';

describe('SheetsFeedback', () => {
  let originalProgressTracker;
  let originalABLogger;
  let mockLogger;

  beforeEach(() => {
    originalProgressTracker = globalThis.ProgressTracker;
    globalThis.ProgressTracker = {
      getInstance: () => ({
        updateProgress: vi.fn(),
        logError: vi.fn(),
      }),
    };

    originalABLogger = globalThis.ABLogger;
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    globalThis.ABLogger = {
      getInstance: () => mockLogger,
    };
  });

  afterEach(() => {
    globalThis.ProgressTracker = originalProgressTracker;
    globalThis.ABLogger = originalABLogger;
    vi.restoreAllMocks();
  });

  describe('getFormatForStatus', () => {
    it('returns green-tinted background for correct status', () => {
      const feedback = new SheetsFeedback([]);
      const format = feedback.getFormatForStatus('correct');
      expect(format.backgroundColor.red).toBeCloseTo(0.7137, 3);
      expect(format.backgroundColor.green).toBeCloseTo(0.8431, 3);
      expect(format.backgroundColor.blue).toBeCloseTo(0.6588, 3);
      expect(format.backgroundColor.alpha).toBe(1);
    });

    it('returns red-tinted background for incorrect status', () => {
      const feedback = new SheetsFeedback([]);
      const format = feedback.getFormatForStatus('incorrect');
      expect(format.backgroundColor.red).toBeCloseTo(0.9176, 3);
      expect(format.backgroundColor.green).toBeCloseTo(0.6, 1);
      expect(format.backgroundColor.blue).toBeCloseTo(0.6, 1);
      expect(format.backgroundColor.alpha).toBe(1);
    });

    it('returns yellow-tinted background for notAttempted status', () => {
      const feedback = new SheetsFeedback([]);
      const format = feedback.getFormatForStatus('notAttempted');
      expect(format.backgroundColor.red).toBe(1);
      expect(format.backgroundColor.green).toBeCloseTo(0.898, 2);
      expect(format.backgroundColor.blue).toBeCloseTo(0.6, 1);
      expect(format.backgroundColor.alpha).toBe(1);
    });

    it.each([['unknown'], ['']])('returns white background for %s status', (status) => {
      const feedback = new SheetsFeedback([]);
      const format = feedback.getFormatForStatus(status);
      expect(format.backgroundColor.red).toBe(1);
      expect(format.backgroundColor.green).toBe(1);
      expect(format.backgroundColor.blue).toBe(1);
      expect(format.backgroundColor.alpha).toBe(1);
    });
  });

  describe('createCellFormatRequest', () => {
    it('creates a repeatCell request with correct grid range', () => {
      const feedback = new SheetsFeedback([]);
      const request = feedback.createCellFormatRequest(4, 5, 'incorrect', 42);

      expect(request.repeatCell.range).toEqual({
        sheetId: 42,
        startRowIndex: 4,
        endRowIndex: 5,
        startColumnIndex: 5,
        endColumnIndex: 6,
      });
      expect(request.repeatCell.fields).toBe('userEnteredFormat.backgroundColor');
    });

    it('uses default sheetId of 0 when not provided', () => {
      const feedback = new SheetsFeedback([]);
      const request = feedback.createCellFormatRequest(0, 0, 'correct');

      expect(request.repeatCell.range.sheetId).toBe(0);
    });

    it('uses correct color for given status', () => {
      const feedback = new SheetsFeedback([]);
      const correct = feedback.createCellFormatRequest(1, 1, 'correct');
      const incorrect = feedback.createCellFormatRequest(2, 2, 'incorrect');

      expect(correct.repeatCell.cell.userEnteredFormat.backgroundColor.red).toBeCloseTo(0.7137, 3);
      expect(incorrect.repeatCell.cell.userEnteredFormat.backgroundColor.red).toBeCloseTo(
        0.9176,
        3
      );
    });
  });

  describe('generateBatchRequestsForSubmission', () => {
    it('returns empty array for submission with no items', () => {
      const feedback = new SheetsFeedback([]);
      const requests = feedback.generateBatchRequestsForSubmission({ items: {} });
      expect(requests).toEqual([]);
    });

    it('skips items without feedback', () => {
      const feedback = new SheetsFeedback([]);
      const submission = {
        items: {
          taskA: {
            pageId: 1,
            // no feedback
          },
        },
      };
      const requests = feedback.generateBatchRequestsForSubmission(submission);
      expect(requests).toEqual([]);
    });

    it('skips items without cellFeedback', () => {
      const feedback = new SheetsFeedback([]);
      const submission = {
        items: {
          taskA: {
            pageId: 1,
            feedback: { cellReference: null },
            getFeedback: vi.fn().mockReturnValue(null),
          },
        },
      };
      const requests = feedback.generateBatchRequestsForSubmission(submission);
      expect(requests).toEqual([]);
    });

    it('warns when item lacks pageId', () => {
      const feedback = new SheetsFeedback([]);
      const submission = {
        items: {
          taskA: {
            taskId: 'task-1',
            feedback: { cellReference: null },
            getFeedback: vi.fn().mockReturnValue({
              type: 'cellReference',
              items: [{ location: [0, 0], status: 'correct' }],
            }),
          },
        },
      };
      // pageId is undefined, should warn
      feedback.generateBatchRequestsForSubmission(submission);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('applyFeedback', () => {
    it('handles empty submissions array without error', () => {
      const feedback = new SheetsFeedback([]);
      // Should not throw
      expect(() => feedback.applyFeedback()).not.toThrow();
    });

    it('warns for submissions without documentId', () => {
      const feedback = new SheetsFeedback([]);
      const submission = { studentId: 's1', items: {} };
      feedback.submissions = [submission];
      feedback.applyFeedback();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing submission or document ID')
      );
    });

    it('processes a valid submission', () => {
      const feedback = new SheetsFeedback([]);
      feedback.generateBatchRequestsForSubmission = vi.fn().mockReturnValue([]);
      feedback.submissions = [
        {
          documentId: 'doc-123',
          studentId: 's1',
          items: {},
        },
      ];
      expect(() => feedback.applyFeedback()).not.toThrow();
    });
  });

  it('builds requests from serialised cell reference feedback items', () => {
    const feedbackPopulator = new SheetsFeedback([]);
    const submission = {
      items: {
        taskA: {
          pageId: 42,
          feedback: { cellReference: null },
          getFeedback: vi.fn().mockReturnValue({
            type: 'cellReference',
            items: [
              { location: [4, 5], status: 'incorrect' },
              { location: [6, 7], status: 'correct' },
            ],
          }),
        },
      },
    };

    const requests = feedbackPopulator.generateBatchRequestsForSubmission(submission);

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.repeatCell.range)).toEqual([
      {
        sheetId: 42,
        startRowIndex: 4,
        endRowIndex: 5,
        startColumnIndex: 5,
        endColumnIndex: 6,
      },
      {
        sheetId: 42,
        startRowIndex: 6,
        endRowIndex: 7,
        startColumnIndex: 7,
        endColumnIndex: 8,
      },
    ]);
    expect(requests[0].repeatCell.cell.userEnteredFormat.backgroundColor.red).toBe(0.9176);
    expect(requests[1].repeatCell.cell.userEnteredFormat.backgroundColor.red).toBe(0.7137);
  });
});
