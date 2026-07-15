/**
 * Tests for the shared PageTitleCard and PageNavCard components.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from 'antd';
import { PageTitleCard, PageNavCard } from './PageHeader';

describe('PageTitleCard', () => {
  it('renders the title at the default level (4)', () => {
    render(<PageTitleCard title="Test Page" />);
    const title = screen.getByText('Test Page');
    expect(title.tagName).toBe('H4');
  });

  it('renders the title at the specified level', () => {
    render(<PageTitleCard title="Test Page" titleLevel={2} />);
    const title = screen.getByText('Test Page');
    expect(title.tagName).toBe('H2');
  });

  it('renders inside a Card', () => {
    const { container } = render(<PageTitleCard title="Test Page" />);
    expect(container.querySelector('.ant-card')).toBeInTheDocument();
  });
});

describe('PageNavCard', () => {
  it('renders a back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<PageNavCard onBack={onBack} backLabel="Go Back" backAriaLabel="Navigate back" />);
    const backButton = screen.getByRole('button', { name: /navigate back/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('aria-label', 'Navigate back');
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<PageNavCard onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render a back button when onBack is not provided', () => {
    render(<PageNavCard />);
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('renders actions on the right side', () => {
    render(
      <PageNavCard
        actions={<Button>Refresh</Button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('renders multiple actions separated by Space', () => {
    render(
      <PageNavCard
        actions={
          <>
            <Button>Action 1</Button>
            <Button>Action 2</Button>
          </>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument();
  });

  it('uses default back label and aria-label when not provided', () => {
    render(<PageNavCard onBack={vi.fn()} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toHaveAttribute('aria-label', 'Go back');
  });

  it('renders inside a Card', () => {
    const { container } = render(<PageNavCard />);
    expect(container.querySelector('.ant-card')).toBeInTheDocument();
  });
});
