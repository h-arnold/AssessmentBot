/**
 * Tests for the shared PageTitleCard and PageNavCard components.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from 'antd';
import { APP_GAP_SM } from '@/theme/spacing';
import { PageTitleCard, PageNavCard } from './PageHeader';

/**
 * Renders a navigation card with the given wrapping option.
 *
 * @param {{ wrapActions?: boolean }} properties - The wrapping option under test.
 * @param {boolean} [properties.wrapActions] - Whether the navigation actions wrap.
 * @returns {HTMLElement} The rendered navigation card.
 */
function renderNavigation(properties: { wrapActions?: boolean }): HTMLElement {
  render(
    <PageNavCard
      {...properties}
      onBack={vi.fn()}
      backLabel="Back to Class overview"
      backAriaLabel="Back to Class overview"
      actions={
        <>
          <Button>Re-run Assessment</Button>
          <Button>Refresh</Button>
        </>
      }
    />
  );
  const card = screen.getByRole('button', { name: 'Back to Class overview' }).closest('.ant-card');
  if (!(card instanceof HTMLElement)) throw new TypeError('Navigation card is missing');
  return card;
}

/**
 * Read the outer layout row and the action group inside a navigation card.
 *
 * Both are located structurally from the Back action — the row is its parent
 * and the action group is the row's last child — so the wrapping assertions
 * survive Ant Design class-name changes.
 *
 * @param {HTMLElement} card - The rendered navigation card.
 * @returns {{row: HTMLElement, actions: HTMLElement}} The outer layout row and the action group.
 */
function navigationLayout(card: HTMLElement): { row: HTMLElement; actions: HTMLElement } {
  const backButton = within(card).getByRole('button', { name: 'Back to Class overview' });
  const row = backButton.parentElement;
  const actions = row?.lastElementChild;
  if (!(row instanceof HTMLElement) || !(actions instanceof HTMLElement)) {
    throw new TypeError('Navigation layout elements are missing');
  }
  return { row, actions };
}

afterEach(() => {
  vi.resetAllMocks();
});

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
    render(<PageNavCard actions={<Button>Refresh</Button>} />);
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

describe('PageNavCard — wrapActions', () => {
  it('keeps the single-row action layout when wrapActions is omitted', () => {
    const card = renderNavigation({});
    const { row, actions } = navigationLayout(card);

    // The outer row applies no shared gap and the action group does not opt in
    // to wrapping: both stay at their single-row defaults.
    expect(row.style.gap).toBe('');
    expect(actions.style.flexWrap).toBe('');
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Re-run Assessment', 'Refresh']);
  });

  it('keeps the single-row action layout when wrapActions is false', () => {
    const card = renderNavigation({ wrapActions: false });
    const { row, actions } = navigationLayout(card);

    expect(row.style.gap).toBe('');
    expect(actions.style.flexWrap).toBe('');
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Re-run Assessment', 'Refresh']);
  });

  it('wraps both action groups with the shared 8px gap when wrapActions is true', () => {
    const card = renderNavigation({ wrapActions: true });
    const { row, actions } = navigationLayout(card);

    // The shared 8px gap lands on the outer row as an inline style, and the
    // action group opts into wrapping through its own inline flex-wrap. The
    // visible wrapped topology is pinned by the browser suite
    // (legacy-assignment-results.spec.ts asserts same-row vs wrapped nav order).
    expect(row.style.gap).toBe(`${APP_GAP_SM}px`);
    expect(actions).toHaveStyle({ 'flex-wrap': 'wrap' });
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Re-run Assessment', 'Refresh']);
  });

  it('leaves button order and callback arguments unchanged when wrapping is enabled', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onReRun = vi.fn();
    const onRefresh = vi.fn();
    render(
      <PageNavCard
        wrapActions
        onBack={onBack}
        backLabel="Back to Class overview"
        backAriaLabel="Back to Class overview"
        actions={
          <>
            <Button onClick={onReRun}>Re-run Assessment</Button>
            <Button onClick={onRefresh}>Refresh</Button>
          </>
        }
      />
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Back to Class overview',
      'Re-run Assessment',
      'Refresh',
    ]);

    await user.click(screen.getByRole('button', { name: 'Back to Class overview' }));
    await user.click(screen.getByRole('button', { name: 'Re-run Assessment' }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onReRun).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledExactlyOnceWith(expect.anything());
    expect(onReRun).toHaveBeenCalledExactlyOnceWith(expect.anything());
    expect(onRefresh).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });
});
