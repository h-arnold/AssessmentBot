import { ConfigProvider, theme } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';

const appThemeToken = {
  colorPrimary: '#1677ff',
} as const;

/**
 * Reads the OS-level reduced motion media query when the runtime supports it.
 *
 * @returns {MediaQueryList | null} The reduced-motion media query object, or null when unsupported.
 */
function getReducedMotionMediaQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
}

/**
 * Tracks the OS-level reduced motion preference for global theme motion control.
 *
 * @returns {boolean} Whether the user prefers reduced motion.
 */
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    getReducedMotionMediaQuery()?.matches ?? false
  );

  useEffect(() => {
    const mediaQuery = getReducedMotionMediaQuery();

    if (mediaQuery === null) {
      return;
    }

    const handleChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Owns shell theme state outside `App.tsx` and applies the matching Ant Design algorithm.
 */
/**
 * Owns shell theme state outside `App.tsx` and applies the matching Ant Design algorithm.
 */
type AppThemeShellProperties = Readonly<{ dashboardContent?: ReactNode }>;

/**
 * Theme-owning wrapper that configures Ant Design tokens and algorithms.
 *
 * @param {AppThemeShellProperties} properties Theme shell configuration values.
 * @returns {JSX.Element} The themed application shell.
 */
export function AppThemeShell(properties: AppThemeShellProperties) {
  const { dashboardContent } = properties;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const themeConfig = useMemo(
    () => ({
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        ...appThemeToken,
        motion: !prefersReducedMotion,
      },
    }),
    [isDarkMode, prefersReducedMotion],
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
