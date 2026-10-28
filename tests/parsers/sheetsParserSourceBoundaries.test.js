import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { withGlobalMocks, saveGlobals, restoreGlobals } from '../helpers/globalMockManager.js';

describe('SheetsParser native source boundaries', () => {
  let SheetsParser;
  let restore;
  let originalSpreadsheetApp;
  let logger;
  let tracker;
  const savedGlobals = saveGlobals(['DocumentParser']);

  beforeAll(async () => {
    globalThis.DocumentParser = (
      await import('#backend/DocumentParsers/DocumentParser.js')
    ).DocumentParser;
    SheetsParser = (await import('#backend/DocumentParsers/SheetsParser.js')).SheetsParser;
  });

  afterAll(() => restoreGlobals(savedGlobals));

  beforeEach(() => {
    logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    tracker = { logError: vi.fn(), captureError: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => logger }),
      ProgressTracker: () => ({ getInstance: () => tracker }),
      SpreadsheetApp: { openById: vi.fn() },
    });
    restore = mockContext.restore;
    originalSpreadsheetApp = mockContext.savedGlobals.SpreadsheetApp;
  });

  afterEach(() => {
    restore();
    expect(globalThis.SpreadsheetApp).toBe(originalSpreadsheetApp);
    vi.restoreAllMocks();
  });

  function definition() {
    return {
      getId: () => 'task-fail',
      pageId: '11',
      taskTitle: 'Failing',
      taskMetadata: { bbox: { startRow: 1, startColumn: 1, numRows: 1, numColumns: 1 } },
      getPrimaryReference: () => ({ content: [[null]] }),
    };
  }

  it.each([
    ['TypeError', new TypeError('spreadsheet API wiring fault')],
    ['ReferenceError', new ReferenceError('spreadsheet API missing')],
    ['non-Error value', { reason: 'spreadsheet API fault' }],
  ])('lets spreadsheet opening %s escape unchanged', (_kind, failure) => {
    const parser = new SheetsParser();
    parser.progressTracker = tracker;
    globalThis.SpreadsheetApp = {
      openById: vi.fn(() => {
        throw failure;
      }),
    };
    let caught;
    try {
      parser.extractSubmissionArtifacts('student-doc', [definition()]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(logger.error).not.toHaveBeenCalled();
    expect(tracker.logError).not.toHaveBeenCalled();
  });

  it.each([
    ['getRange', 'TypeError', new TypeError('range API wiring fault')],
    ['getRange', 'ReferenceError', new ReferenceError('range API missing')],
    ['getRange', 'non-Error value', { reason: 'range API fault' }],
    ['getFormulas', 'TypeError', new TypeError('formula API wiring fault')],
    ['getFormulas', 'ReferenceError', new ReferenceError('formula API missing')],
    ['getFormulas', 'non-Error value', { reason: 'formula API fault' }],
  ])('lets %s %s escape unchanged', (method, _kind, failure) => {
    const parser = new SheetsParser();
    parser.progressTracker = tracker;
    const sheet = {
      getSheetId: () => 11,
      getRange: () =>
        method === 'getRange'
          ? (() => {
              throw failure;
            })()
          : {
              getFormulas: () => {
                throw failure;
              },
            },
    };
    globalThis.SpreadsheetApp = { openById: vi.fn(() => ({ getSheets: () => [sheet] })) };
    let caught;
    try {
      parser.extractSubmissionArtifacts('student-doc', [definition()]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(logger.error).not.toHaveBeenCalled();
    expect(tracker.logError).not.toHaveBeenCalled();
  });
});
