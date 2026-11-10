import '@/test/classes/ClassesPage.mockSetup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect, type JSX } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import {
  resetClassesPageComponentMocks,
  useStartupWarmupStateMock,
  mockClassPage,
  mockUseClassSelection,
} from '@/test/classes/classesPageComponentTestSetup';
import { createReadyWarmupState } from '@/test/classes/classesPageWarmupFixtures';
import { renderClassesPage } from '../test/classes/classesPageTestHelpers';
import { createAppQueryClient } from '@/query/queryClient';
import { ClassesPage } from './ClassesPage';

/** Mounts observed after the class-scoped key changes and remounts the page. */
const EXPECTED_MOUNTS_AFTER_CLASS_CHANGE = 2;

beforeEach(() => {
  resetClassesPageComponentMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('Shell integration', () => {
  beforeEach(() => {
    useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
    // Reset context mock to default state (no class selected)
    mockUseClassSelection.mockReturnValue({
      selectedClassId: null,
      className: null,
      onSelectClass: vi.fn(),
      onNavigateToClasses: vi.fn(),
    });
  });

  it('renders the View button as enabled (not disabled)', () => {
    renderClassesPage();

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    for (const button of viewButtons) {
      expect(button).toBeEnabled();
    }
  });

  it('clicking the View button calls onSelectClass from context', async () => {
    const user = userEvent.setup();
    const onSelectClass = vi.fn();
    mockUseClassSelection.mockReturnValue({
      selectedClassId: null,
      className: null,
      onSelectClass,
      onNavigateToClasses: vi.fn(),
    });

    renderClassesPage();

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    await user.click(viewButtons[0]);

    // onSelectClass should have been called with classId and className
    expect(onSelectClass).toHaveBeenCalled();
    const callArguments = onSelectClass.mock.calls[0] as unknown[];
    expect(callArguments[0]).toBeTruthy();
    expect(callArguments[1]).toBeTruthy();
  });

  it('when selectedClassId is set in context, ClassPage is rendered with correct classId', () => {
    const testClassId = 'class-test-123';
    mockUseClassSelection.mockReturnValue({
      selectedClassId: testClassId,
      className: 'Test Class',
      onSelectClass: vi.fn(),
      onNavigateToClasses: vi.fn(),
    });

    renderClassesPage();

    // ClassPage should be rendered
    expect(mockClassPage).toHaveBeenCalled();
    // ClassPage should receive the correct classId
    const classPageProperties = mockClassPage.mock.calls[0][0] as Record<string, unknown>;
    expect(classPageProperties.classId).toBe(testClassId);
  });

  it('remounts ClassPage when the selected class changes so class-scoped state resets', () => {
    // ClassPage is composed with the class-scoped `key`, so a class change
    // guarantees a remount (clearing the mode selection and its retained
    // availability) rather than an in-place update of the existing instance.
    // The providers are applied as the render wrapper (not baked into the
    // element) so the rerender below re-renders the same tree and only the
    // class-scoped key can produce the remount.
    let mountCount = 0;

    /**
     * ClassPage double that counts its mounts.
     *
     * @returns {JSX.Element} An empty marker element.
     */
    function CountingClassPage(): JSX.Element {
      useEffect(() => {
        mountCount += 1;
      }, []);
      return createElement('div');
    }
    mockClassPage.mockImplementation(CountingClassPage);

    mockUseClassSelection.mockReturnValue({
      selectedClassId: 'class-a',
      className: 'Class A',
      onSelectClass: vi.fn(),
      onNavigateToClasses: vi.fn(),
    });
    const queryClient = createAppQueryClient();
    const { rerender } = render(createElement(ClassesPage), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    });
    expect(mountCount).toBe(1);

    mockUseClassSelection.mockReturnValue({
      selectedClassId: 'class-b',
      className: 'Class B',
      onSelectClass: vi.fn(),
      onNavigateToClasses: vi.fn(),
    });
    rerender(createElement(ClassesPage));

    expect(mountCount).toBe(EXPECTED_MOUNTS_AFTER_CLASS_CHANGE);
  });

  it('the View button does not have tabIndex=-1', () => {
    renderClassesPage();

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    for (const button of viewButtons) {
      expect(button).not.toHaveAttribute('tabIndex', '-1');
    }
  });
});
