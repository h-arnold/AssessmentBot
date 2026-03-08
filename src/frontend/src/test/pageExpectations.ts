import type { AppNavigationKey } from '../navigation/appNavigation';

export const pageExpectations = [
  {
    key: 'dashboard',
    heading: 'Dashboard',
    summary: 'Review your assessment overview and recent activity.',
  },
  {
    key: 'classes',
    heading: 'Classes',
    summary: 'Organise class cohorts and monitor assessment progress.',
  },
  {
    key: 'assignments',
    heading: 'Assignments',
    summary: 'Track assignment status and upcoming marking tasks.',
  },
  {
    key: 'settings',
    heading: 'Settings',
    summary: 'Configure AssessmentBot preferences and workspace options.',
  },
] as const satisfies ReadonlyArray<{
  key: AppNavigationKey;
  heading: string;
  summary: string;
}>;

export const dashboardPageSummaryText = (() => {
  const dashboardPage = pageExpectations.find((page) => page.key === 'dashboard');

  if (dashboardPage === undefined) {
    throw new Error('The "dashboard" page expectation was not found and is required by tests.');
  }

  return dashboardPage.summary;
})();
