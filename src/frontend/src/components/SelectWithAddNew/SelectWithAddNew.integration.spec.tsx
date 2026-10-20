import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('SelectWithAddNew bulk modal integration', () => {
  // Test 14: All existing Select functionality still works
  describe('Existing Select functionality', () => {
    it('All existing Select functionality still works after SelectWithAddNew integration', async () => {
      // This test should fail initially because we haven't implemented SelectWithAddNew yet
      // After implementation, it should pass to verify no regression

      // Import the actual BulkCreateModal (not mocked)
      const { BulkCreateModal } = await import('@/features/classes/bulk/BulkCreateModal');

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

      const cohortSelect = screen.getByRole('combobox', { name: 'Cohort' });
      expect(cohortSelect).toBeInTheDocument();

      // This should work - existing options are available
      await userEvent.setup().click(cohortSelect);
      expect(screen.getByText('Cohort 2025')).toBeInTheDocument();
      expect(screen.getByText('Cohort 2026')).toBeInTheDocument();

      expect(screen.getByText('Add new cohort')).toBeInTheDocument();
    });
  });

  describe('Add new command', () => {
    it('dispatches the selected Add new command immediately', async () => {
      const { BulkCreateModal } = await import('@/features/classes/bulk/BulkCreateModal');

      const cohortOptions = [{ label: 'Cohort 2025', value: 'cohort-2025' }];

      const yearGroupOptions = [{ label: 'Year 10', value: 'year-10' }];

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
      const user = userEvent.setup();
      await user.click(cohortSelect);

      const addNewOption = await screen.findByRole('option', { name: 'Add new cohort' });
      await user.click(addNewOption);

      expect(mockOnCohortAddNew).toHaveBeenCalledTimes(1);
    });
  });
});
