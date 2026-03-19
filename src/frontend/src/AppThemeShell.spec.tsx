import { App as AntdApp } from 'antd';
import { act, render, screen } from '@testing-library/react';
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
  it('provides Ant Design App context to dashboard content', async () => {
    await act(async () => {
      render(<AppThemeShell dashboardContent={<AppContextProbe />} />);
    });

    expect(screen.getByTestId('app-context-probe')).toHaveTextContent('function');
  });
});
