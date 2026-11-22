import { describe, it, expect } from 'vitest';
import {
  mockProgressTracker,
  mockSheets,
  useBatchUpdateUtilityMocks,
} from './batchUpdateUtilityTestHelpers.js';

// Load the module under test
const { BatchUpdateUtility } = require('#backend/Utils/BatchUpdateUtility.js');

describe('BatchUpdateUtility', () => {
  useBatchUpdateUtilityMocks();

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
});
