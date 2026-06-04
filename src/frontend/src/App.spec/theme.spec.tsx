/**
 * Theme tests for App shell.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import appStyles from '../index.css?raw';
import {
  installPendingApiHandlerMock,
  renderPendingApp,
  getThemeModeSwitch,
  ariaCheckedAttribute,
  getNavigationLabel,
} from './shared-setup';

describe('App theme', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('toggle control renders with accessible label', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    expect(getThemeModeSwitch()).toBeInTheDocument();
  });

  it('toggle callback flips theme state between light and dark', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const themeModeSwitch = getThemeModeSwitch();

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'false');

    act(() => {
      fireEvent.click(themeModeSwitch);
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'true');

    act(() => {
      fireEvent.click(themeModeSwitch);
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'false');
  });

  it('theme toggle updates the Ant Design shell styling', async () => {
    const { AppThemeShell } = await import('../AppThemeShell');

    await act(async () => {
      render(<AppThemeShell />);
    });

    const header = document.querySelector('.app-header');

    if (!(header instanceof HTMLElement)) {
      throw new TypeError('Expected the themed app header to be rendered.');
    }

    const initialHeaderBackground = header.style.backgroundColor;

    act(() => {
      fireEvent.click(getThemeModeSwitch());
    });

    await waitFor(() => {
      expect(header.style.backgroundColor).not.toBe(initialHeaderBackground);
    });
  });

  it('theme toggle state persists during in-app page navigation', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const themeModeSwitch = getThemeModeSwitch();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

    act(() => {
      fireEvent.click(themeModeSwitch);
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('classes') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('settings') })
      );
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'true');
  });

  it('theme-compatible styles are applied', () => {
    expect(appStyles).not.toMatch(/body\s*{[^}]*background:\s*#[\da-f]{3,8}/i);
    expect(appStyles).not.toMatch(/\.app-header\s*{[^}]*color:\s*#[\da-f]{3,8}/i);
  });
});
