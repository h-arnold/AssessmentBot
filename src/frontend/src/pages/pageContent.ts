/**
 * Single source of truth for the shell page headings and placeholder summaries.
 * Navigation labels and page components should stay aligned with these values.
 */
export const pageContent = {
  dashboard: {
    heading: 'Dashboard',
    summary: 'Review your assessment overview and recent activity.',
  },
  assignments: {
    heading: 'Assignments',
    summary: 'Track assignment status and upcoming marking tasks.',
  },
  settings: {
    heading: 'Settings',
    summary: 'Configure AssessmentBot preferences and workspace options.',
  },
} as const;
