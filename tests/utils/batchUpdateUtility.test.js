import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Load the module under test
const { BatchUpdateUtility } = require('../../src/backend/Utils/BatchUpdateUtility.js');

// Global mock context - will be set up in beforeEach and torn down in afterEach
let restoreBatchUtilityGlobals;

describe('BatchUpdateUtility', () => {
  const originalConsole = { ...console };
  let mockProgressTracker;
  let mockSheets;

  beforeEach(() => {
    // Replace console.log with a spy
    console.log = vi.fn();

    // Create mock ProgressTracker
    mockProgressTracker = {
      logError: vi.fn(),
      logAndThrowError: vi.fn((message, context) => {
        const error = new Error(message);
        throw error;
      }),
    };

    // Create mock Sheets service
    mockSheets = {
      Spreadsheets: {
        batchUpdate: vi.fn(),
      },
    };

    // Setup global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
      Sheets: () => mockSheets,
    });
    restoreBatchUtilityGlobals = mockContext.restore;
  });

  afterEach(() => {
    // Restore console
    Object.assign(console, originalConsole);

    // Restore globals
    restoreBatchUtilityGlobals();

    vi.resetAllMocks();
  });

  describe('executeBatchUpdate', () => {
    describe('input validation', () => {
      it('returns undefined when requests is null', () => {
        const result = BatchUpdateUtility.executeBatchUpdate(null, 'spreadsheet-id');

        expect(result).toBeUndefined();
        expect(mockProgressTracker.logError).toHaveBeenCalledWith('No batch requests to execute.');
      });

      it('returns undefined when requests is empty array', () => {
        const result = BatchUpdateUtility.executeBatchUpdate([], 'spreadsheet-id');

        expect(result).toBeUndefined();
        expect(mockProgressTracker.logError).toHaveBeenCalledWith('No batch requests to execute.');
      });

      it('throws error when spreadsheetId is null', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];

        expect(() => {
          BatchUpdateUtility.executeBatchUpdate(requests, null);
        }).toThrow('Spreadsheet ID is required for batch updates.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Spreadsheet ID is required for batch updates.'
        );
      });

      it('throws error when spreadsheetId is undefined', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];

        expect(() => {
          BatchUpdateUtility.executeBatchUpdate(requests, undefined);
        }).toThrow('Spreadsheet ID is required for batch updates.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Spreadsheet ID is required for batch updates.'
        );
      });

      it('throws error when spreadsheetId is empty string', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];

        expect(() => {
          BatchUpdateUtility.executeBatchUpdate(requests, '');
        }).toThrow('Spreadsheet ID is required for batch updates.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Spreadsheet ID is required for batch updates.'
        );
      });
    });

    describe('successful execution', () => {
      it('calls Sheets.Spreadsheets.batchUpdate with correct parameters', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];
        const spreadsheetId = 'test-spreadsheet-id';
        const mockResponse = { replies: [] };

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue(mockResponse);

        const result = BatchUpdateUtility.executeBatchUpdate(requests, spreadsheetId);

        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests },
          spreadsheetId
        );
        expect(result).toBe(mockResponse);
        expect(console.log).toHaveBeenCalledWith('Batch update executed successfully.');
      });

      it('returns the response from batchUpdate', () => {
        const requests = [{ deleteSheet: { sheetId: 123 } }];
        const spreadsheetId = 'spreadsheet-123';
        const mockResponse = { replies: [{ deleteSheet: {} }] };

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue(mockResponse);

        const result = BatchUpdateUtility.executeBatchUpdate(requests, spreadsheetId);

        expect(result).toBe(mockResponse);
      });

      it('handles multiple requests in a single batch', () => {
        const requests = [
          { addSheet: { properties: { title: 'Sheet1' } } },
          { addSheet: { properties: { title: 'Sheet2' } } },
          { deleteSheet: { sheetId: 123 } },
        ];
        const spreadsheetId = 'test-spreadsheet-id';
        const mockResponse = { replies: [] };

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue(mockResponse);

        const result = BatchUpdateUtility.executeBatchUpdate(requests, spreadsheetId);

        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests },
          spreadsheetId
        );
        expect(result).toBe(mockResponse);
      });
    });

    describe('error handling', () => {
      it('throws error when Sheets.Spreadsheets.batchUpdate throws', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];
        const spreadsheetId = 'test-spreadsheet-id';
        const mockError = new Error('API rate limit exceeded');

        mockSheets.Spreadsheets.batchUpdate.mockImplementation(() => {
          throw mockError;
        });

        expect(() => {
          BatchUpdateUtility.executeBatchUpdate(requests, spreadsheetId);
        }).toThrow('Error applying batch update.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Error applying batch update.',
          mockError
        );
      });

      it('throws error with custom message when batchUpdate fails', () => {
        const requests = [{ addSheet: { properties: { title: 'Sheet1' } } }];
        const spreadsheetId = 'test-spreadsheet-id';
        const mockError = new Error('Network error');

        mockSheets.Spreadsheets.batchUpdate.mockImplementation(() => {
          throw mockError;
        });

        try {
          BatchUpdateUtility.executeBatchUpdate(requests, spreadsheetId);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toBe('Error applying batch update.');
        }

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Error applying batch update.',
          mockError
        );
      });
    });
  });

  describe('executeMultipleBatchUpdates', () => {
    describe('input validation', () => {
      it('throws error when batchUpdates is null', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(null);
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });

      it('throws error when batchUpdates is undefined', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(undefined);
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });

      it('throws error when batchUpdates is empty array', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates([]);
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });

      it('throws error when batchUpdates is not an array', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates({});
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });

      it('throws error when batchUpdates is a string', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates('not an array');
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });

      it('throws error when batchUpdates is a number', () => {
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(123);
        }).toThrow('No batch updates provided.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'No batch updates provided.'
        );
      });
    });

    describe('successful execution with multiple spreadsheets', () => {
      it('executes batch updates for multiple spreadsheets and returns responses', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
          },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet2' } } }],
            spreadsheetId: 'spreadsheet-2',
          },
        ];

        const mockResponse1 = { replies: [] };
        const mockResponse2 = { replies: [] };

        mockSheets.Spreadsheets.batchUpdate
          .mockImplementationOnce(() => mockResponse1)
          .mockImplementationOnce(() => mockResponse2);

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(2);
        expect(results[0]).toBe(mockResponse1);
        expect(results[1]).toBe(mockResponse2);

        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledTimes(2);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenNthCalledWith(
          1,
          { requests: batchUpdates[0].requests },
          batchUpdates[0].spreadsheetId
        );
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenNthCalledWith(
          2,
          { requests: batchUpdates[1].requests },
          batchUpdates[1].spreadsheetId
        );
      });

      it('returns empty array when all updates are skipped due to empty requests', () => {
        const batchUpdates = [
          { requests: [], spreadsheetId: 'spreadsheet-1' },
          { requests: [], spreadsheetId: 'spreadsheet-2' },
        ];

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(0);
        expect(mockProgressTracker.logError).toHaveBeenCalledTimes(2);
        expect(mockProgressTracker.logError).toHaveBeenNthCalledWith(
          1,
          'No batch requests to execute for index 0.',
          { batchUpdate: batchUpdates[0] }
        );
        expect(mockProgressTracker.logError).toHaveBeenNthCalledWith(
          2,
          'No batch requests to execute for index 1.',
          { batchUpdate: batchUpdates[1] }
        );
      });

      it('skips empty requests but continues processing other updates', () => {
        const batchUpdates = [
          { requests: [], spreadsheetId: 'spreadsheet-1' },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet2' } } }],
            spreadsheetId: 'spreadsheet-2',
          },
          { requests: [], spreadsheetId: 'spreadsheet-3' },
        ];

        const mockResponse = { replies: [] };
        mockSheets.Spreadsheets.batchUpdate.mockReturnValue(mockResponse);

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(1);
        expect(results[0]).toBe(mockResponse);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledTimes(1);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests: batchUpdates[1].requests },
          batchUpdates[1].spreadsheetId
        );
        expect(mockProgressTracker.logError).toHaveBeenCalledTimes(2);
      });
    });

    describe('error handling in multiple batch updates', () => {
      it('throws error when spreadsheetId is missing in a batch update', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
          },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet2' } } }],
            spreadsheetId: null,
          },
        ];

        // The error thrown is wrapped by the catch block, so it's "Error applying batch update at index 1."
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        }).toThrow('Error applying batch update at index 1.');

        // But the first logAndThrowError call should have the original message
        expect(mockProgressTracker.logAndThrowError).toHaveBeenNthCalledWith(
          1,
          'Spreadsheet ID is required for batch update at index 1.'
        );
        // And the second call (in catch) wraps it
        expect(mockProgressTracker.logAndThrowError).toHaveBeenNthCalledWith(
          2,
          'Error applying batch update at index 1.',
          expect.any(Object)
        );
      });

      it('throws error when spreadsheetId is undefined in a batch update', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: undefined,
          },
        ];

        // The error thrown is wrapped by the catch block
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        }).toThrow('Error applying batch update at index 0.');

        // First call has the original message
        expect(mockProgressTracker.logAndThrowError).toHaveBeenNthCalledWith(
          1,
          'Spreadsheet ID is required for batch update at index 0.'
        );
        // Second call (in catch) wraps it
        expect(mockProgressTracker.logAndThrowError).toHaveBeenNthCalledWith(
          2,
          'Error applying batch update at index 0.',
          expect.any(Object)
        );
      });

      it('throws error when batchUpdate requests is null', () => {
        const batchUpdates = [
          {
            requests: null,
            spreadsheetId: 'spreadsheet-1',
          },
        ];

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(0);
        expect(mockProgressTracker.logError).toHaveBeenCalledWith(
          'No batch requests to execute for index 0.',
          { batchUpdate: batchUpdates[0] }
        );
      });

      it('throws error with context when Sheets.Spreadsheets.batchUpdate throws', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
          },
        ];

        const mockError = new Error('Permission denied');
        mockSheets.Spreadsheets.batchUpdate.mockImplementation(() => {
          throw mockError;
        });

        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        }).toThrow('Error applying batch update at index 0.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Error applying batch update at index 0.',
          { error: mockError, batchUpdate: batchUpdates[0] }
        );
      });

      it('includes error context when batchUpdate fails', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
          },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet2' } } }],
            spreadsheetId: 'spreadsheet-2',
          },
        ];

        const mockError = new Error('Quota exceeded');
        mockSheets.Spreadsheets.batchUpdate
          .mockImplementationOnce(() => ({ replies: [] }))
          .mockImplementationOnce(() => {
            throw mockError;
          });

        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        }).toThrow('Error applying batch update at index 1.');

        expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
          'Error applying batch update at index 1.',
          { error: mockError, batchUpdate: batchUpdates[1] }
        );
      });
    });

    describe('mixed scenarios', () => {
      it('processes all valid updates even when some fail validation', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
          },
          { requests: [], spreadsheetId: 'spreadsheet-2' },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet3' } } }],
            spreadsheetId: 'spreadsheet-3',
          },
          {
            requests: [{ addSheet: { properties: { title: 'Sheet4' } } }],
            spreadsheetId: null,
          },
        ];

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue({ replies: [] });

        // This should throw on the 4th item (index 3) due to missing spreadsheetId
        // The error message is wrapped by the catch block
        expect(() => {
          BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        }).toThrow('Error applying batch update at index 3.');

        // First update should have been processed
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests: batchUpdates[0].requests },
          batchUpdates[0].spreadsheetId
        );

        // Third update should also have been processed (index 2)
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests: batchUpdates[2].requests },
          batchUpdates[2].spreadsheetId
        );

        // Second update (empty requests) should have been skipped with log
        expect(mockProgressTracker.logError).toHaveBeenCalledWith(
          'No batch requests to execute for index 1.',
          { batchUpdate: batchUpdates[1] }
        );

        // The first logAndThrowError call should have the original spreadsheetId error
        expect(mockProgressTracker.logAndThrowError).toHaveBeenNthCalledWith(
          1,
          'Spreadsheet ID is required for batch update at index 3.'
        );
      });
    });

    describe('edge cases', () => {
      it('handles batchUpdates with extra properties', () => {
        const batchUpdates = [
          {
            requests: [{ addSheet: { properties: { title: 'Sheet1' } } }],
            spreadsheetId: 'spreadsheet-1',
            extraProp: 'extra value',
          },
        ];

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue({ replies: [] });

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(1);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests: batchUpdates[0].requests },
          batchUpdates[0].spreadsheetId
        );
      });

      it('handles large number of batch updates', () => {
        const batchUpdates = Array.from({ length: 100 }, (_, i) => ({
          requests: [{ addSheet: { properties: { title: `Sheet${i}` } } }],
          spreadsheetId: `spreadsheet-${i}`,
        }));

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue({ replies: [] });

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(100);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledTimes(100);
      });

      it('handles requests with complex objects', () => {
        const complexRequests = [
          {
            addSheet: {
              properties: {
                title: 'Complex Sheet',
                sheetId: 12345,
              },
            },
          },
          {
            updateCells: {
              range: { sheetId: 0, startRowIndex: 0, startColumnIndex: 0 },
              rows: [{ values: [{ stringValue: 'test' }] }],
              fields: 'userEnteredValue',
            },
          },
        ];

        const batchUpdates = [{ requests: complexRequests, spreadsheetId: 'spreadsheet-1' }];

        mockSheets.Spreadsheets.batchUpdate.mockReturnValue({ replies: [] });

        const results = BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);

        expect(results).toHaveLength(1);
        expect(mockSheets.Spreadsheets.batchUpdate).toHaveBeenCalledWith(
          { requests: complexRequests },
          'spreadsheet-1'
        );
      });
    });
  });

  describe('module export', () => {
    it('exports BatchUpdateUtility object', () => {
      expect(BatchUpdateUtility).toBeDefined();
      expect(typeof BatchUpdateUtility).toBe('object');
    });

    it('exports executeBatchUpdate method', () => {
      expect(BatchUpdateUtility.executeBatchUpdate).toBeDefined();
      expect(typeof BatchUpdateUtility.executeBatchUpdate).toBe('function');
    });

    it('exports executeMultipleBatchUpdates method', () => {
      expect(BatchUpdateUtility.executeMultipleBatchUpdates).toBeDefined();
      expect(typeof BatchUpdateUtility.executeMultipleBatchUpdates).toBe('function');
    });
  });
});
