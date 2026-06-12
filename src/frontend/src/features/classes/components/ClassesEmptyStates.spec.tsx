import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassesNoActiveClassroomsEmptyState } from './ClassesEmptyStates';

describe('ClassesNoActiveClassroomsEmptyState', () => {
  it('renders the no-active-classrooms empty-state description', () => {
    render(<ClassesNoActiveClassroomsEmptyState />);

    expect(
      screen.getByText('No active Google Classrooms are available.')
    ).toBeInTheDocument();
  });
});
