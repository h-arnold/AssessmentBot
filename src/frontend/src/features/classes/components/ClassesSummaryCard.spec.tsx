import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassesSummaryCard } from './ClassesSummaryCard';

describe('ClassesSummaryCard', () => {
  it('renders status counts and selected count', () => {
    render(
      <ClassesSummaryCard
        rows={[
          {
            classId: 'active-1',
            className: 'Active',
            status: 'active',
            cohortLabel: 'C1',
            yearGroupLabel: 'Y1',
            courseLength: 2,
            active: true,
          },
          {
            classId: 'inactive-1',
            className: 'Inactive',
            status: 'inactive',
            cohortLabel: 'C2',
            yearGroupLabel: 'Y2',
            courseLength: 1,
            active: false,
          },
          {
            classId: 'not-created-1',
            className: 'Not Created',
            status: 'notCreated',
            cohortLabel: null,
            yearGroupLabel: null,
            courseLength: null,
            active: null,
          },
          {
            classId: 'orphaned-1',
            className: 'Orphaned',
            status: 'orphaned',
            cohortLabel: null,
            yearGroupLabel: null,
            courseLength: null,
            active: false,
          },
        ]}
        selectedCount={2}
      />
    );

    expect(screen.getByText('Total rows')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Not created')).toBeInTheDocument();
    expect(screen.getByText('Orphaned')).toBeInTheDocument();
    expect(screen.getByText('Selected rows: 2')).toBeInTheDocument();
  });
});
