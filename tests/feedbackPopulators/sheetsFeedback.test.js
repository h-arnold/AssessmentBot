import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SheetsFeedback from '../../src/backend/FeedbackPopulators/SheetsFeedback.js';

describe('SheetsFeedback', () => {
  let originalProgressTracker;

  beforeEach(() => {
    originalProgressTracker = globalThis.ProgressTracker;
    globalThis.ProgressTracker = {
      getInstance: () => ({
        updateProgress: vi.fn(),
        logError: vi.fn(),
      }),
    };
  });

  afterEach(() => {
    globalThis.ProgressTracker = originalProgressTracker;
    vi.restoreAllMocks();
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
