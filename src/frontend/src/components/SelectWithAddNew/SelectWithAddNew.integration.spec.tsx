import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Section 7 - Red Loop: Integration tests for SelectWithAddNew workflow
// These tests will fail until the full integration is implemented

describe('Section 7 - SelectWithAddNew Integration Tests', () => {
  // Test 14: All existing Select functionality still works
  describe('Existing Select functionality', () => {
    it('All existing Select functionality still works after SelectWithAddNew integration', async () => {
      // This test should fail initially because we haven't implemented SelectWithAddNew yet
      // After implementation, it should pass to verify no regression
      
      // Import the actual BulkCreateModal (not mocked)
      const { BulkCreateModal } = await import('../../features/classes/bulk/BulkCreateModal');
      
      const cohortOptions = [
        { label: 'Cohort 2025', value: 'cohort-2025' },
        { label: 'Cohort 2026', value: 'cohort-2026' },
      ];
      
      const yearGroupOptions = [
        { label: 'Year 10', value: 'year-10' },
        { label: 'Year 11', value: 'year-11' },
      ];

      render(
        <BulkCreateModal
          open
          cohortOptions={cohortOptions}
          yearGroupOptions={yearGroupOptions}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // This should work - existing Select functionality
      const cohortSelect = screen.getByRole('combobox', { name: 'Cohort' });
      expect(cohortSelect).toBeInTheDocument();
      
      // This should work - existing options are available
      fireEvent.mouseDown(cohortSelect);
      expect(screen.getByText('Cohort 2025')).toBeInTheDocument();
      expect(screen.getByText('Cohort 2026')).toBeInTheDocument();

      // This should fail initially - 'Add new' option doesn't exist yet
      // After implementation, it should exist
      expect(screen.getByText('Add new cohort')).toBeInTheDocument();
    });
  });



  // Test 16: Debounce verification
  describe('Debounce verification', () => {
    it('Rapid clicks on \'Add new\' only open modal once (debounce verification)', async () => {
      // This test should fail because debounce isn't implemented yet
      
      const { BulkCreateModal } = await import('../../features/classes/bulk/BulkCreateModal');
      
      const cohortOptions = [
        { label: 'Cohort 2025', value: 'cohort-2025' },
      ];
      
      const yearGroupOptions = [
        { label: 'Year 10', value: 'year-10' },
      ];

      const mockOnCohortAddNew = vi.fn();

      render(
        <BulkCreateModal
          open
          cohortOptions={cohortOptions}
          yearGroupOptions={yearGroupOptions}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onCohortAddNew={mockOnCohortAddNew}
          onYearGroupAddNew={vi.fn()}
          pendingCreatedCohortKey={undefined}
          pendingCreatedYearGroupKey={undefined}
        />
      );

      const cohortSelect = screen.getByRole('combobox', { name: 'Cohort' });
      fireEvent.mouseDown(cohortSelect);

      // This should fail - 'Add new cohort' option doesn't exist yet
      const addNewOption = screen.getByText('Add new cohort');
      
      // Rapid clicks
      fireEvent.click(addNewOption);
      fireEvent.click(addNewOption);
      fireEvent.click(addNewOption);

      // This should fail - onCohortAddNew is not called yet
      // After implementation, it should be called only once due to debounce
      await waitFor(() => {
        expect(mockOnCohortAddNew).toHaveBeenCalledTimes(1);
      });
    });
  });
});
