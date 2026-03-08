import { ConfigProvider, theme } from 'antd';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AppShell } from './AppShell';

const appThemeToken = {
  colorPrimary: '#1677ff',
} as const;

/**
 * Owns shell theme state outside `App.tsx` and applies the matching Ant Design algorithm.
 */
export function AppThemeShell({ dashboardContent }: { dashboardContent?: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: appThemeToken,
    }),
    [isDarkMode],
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <AppShell
        dashboardContent={dashboardContent}
        isDarkMode={isDarkMode}
        onThemeModeChange={setIsDarkMode}
      />
    </ConfigProvider>
  );
}
