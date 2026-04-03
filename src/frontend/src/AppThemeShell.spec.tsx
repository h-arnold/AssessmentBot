import { App as AntdApp } from 'antd';
import { act, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { AppThemeShell } from './AppThemeShell';

/**
 * Reads the Ant Design App context exposed by the shell.
 *
 * @returns {JSX.Element} A small probe for the App context.
 */
function AppContextProbe() {
  const { message } = AntdApp.useApp();

  return <div data-testid="app-context-probe">{typeof message.success}</div>;
}

describe('AppThemeShell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });



  it('safely renders when matchMedia is unavailable', async () => {
    const originalMatchMedia = globalThis.matchMedia;
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      await act(async () => {
        render(<AppThemeShell dashboardContent={<AppContextProbe />} />);
      });

      expect(screen.getByTestId('app-context-probe')).toHaveTextContent('function');
    } finally {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('subscribes to reduced-motion changes and removes listeners on unmount', async () => {
    const changeListeners = new Set<() => void>();
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((eventName: string, listener: () => void) => {
        if (eventName === 'change') {
          changeListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn((eventName: string, listener: () => void) => {
        if (eventName === 'change') {
          changeListeners.delete(listener);
        }
      }),
    };

    const matchMediaSpy = vi
      .spyOn(globalThis, 'matchMedia')
      .mockReturnValue(mediaQuery as unknown as MediaQueryList);

    const renderResult = render(<AppThemeShell dashboardContent={<AppContextProbe />} />);

    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    act(() => {
      mediaQuery.matches = true;
      for (const listener of changeListeners) {
        listener();
      }
    });

    renderResult.unmount();

    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('provides Ant Design App context to dashboard content', async () => {
    await act(async () => {
      render(<AppThemeShell dashboardContent={<AppContextProbe />} />);
    });

    expect(screen.getByTestId('app-context-probe')).toHaveTextContent('function');
  });
});
