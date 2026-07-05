/**
 * Tests for `ClassPageHeaderActions` — the two top-right header action buttons.
 *
 * @remarks
 * The component renders a disabled `Edit Student Details` button (wrapped in
 * a `Tooltip` with "Coming soon") and an enabled `Start New Assessment`
 * button. Pure presentational; receives `onStartNewAssessment` as a prop.
 *
 * @see SPEC_CLASS_PAGE.md - "ClassPageHeaderActions"
 * @see CLASS_PAGE_LAYOUT.md - "Page Heading and Header Actions"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassPageHeaderActions } from './ClassPageHeaderActions';

describe('ClassPageHeaderActions', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the disabled Edit Student Details button', () => {
    render(<ClassPageHeaderActions onStartNewAssessment={vi.fn()} />);

    const button = screen.getByRole('button', { name: /edit student details/i });
    expect(button).toBeDisabled();
  });

  it('renders the enabled Start New Assessment button', () => {
    render(<ClassPageHeaderActions onStartNewAssessment={vi.fn()} />);

    const button = screen.getByRole('button', { name: /start new assessment/i });
    expect(button).toBeEnabled();
  });

  it('renders EditOutlined icon on disabled Edit Student Details and PlusOutlined icon on Start New Assessment', () => {
    render(<ClassPageHeaderActions onStartNewAssessment={vi.fn()} />);

    const editButton = screen.getByRole('button', { name: /edit student details/i });
    expect(editButton.querySelector('.anticon-edit')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /start new assessment/i });
    expect(startButton.querySelector('.anticon-plus')).toBeInTheDocument();
  });

  it('calls onStartNewAssessment when the primary button is clicked', async () => {
    const onStartNewAssessment = vi.fn();

    render(<ClassPageHeaderActions onStartNewAssessment={onStartNewAssessment} />);

    const button = screen.getByRole('button', { name: /start new assessment/i });
    await user.click(button);

    expect(onStartNewAssessment).toHaveBeenCalledTimes(1);
  });

  it('wraps the disabled button in a Tooltip with Coming soon text', async () => {
    render(<ClassPageHeaderActions onStartNewAssessment={vi.fn()} />);

    // The Tooltip wraps a <span> around the disabled Button so the hover
    // event is captured by the Tooltip trigger (antd v6 Tooltip does not
    // trigger on a disabled Button directly).
    const button = screen.getByRole('button', { name: /edit student details/i });
    const wrapper = button.parentElement!;
    await user.hover(wrapper);

    // The Tooltip renders its content in a portal; findByText waits for
    // the portal content to appear.
    const tooltip = await screen.findByText('Coming soon');
    expect(tooltip).toBeInTheDocument();
  });
});
