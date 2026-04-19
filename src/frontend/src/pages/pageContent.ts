/**
 * Single source of truth for the shell page headings and summaries.
 * Navigation labels and page components should stay aligned with these values.
 */
export const pageContent = {
  dashboard: {
    heading: 'Dashboard',
    summary: 'Review your assessment overview and recent activity.',
  },
  assignments: {
    heading: 'Assignments',
    summary:
      'Review assignment-definition partials and remove obsolete definitions without loading full task data.',
  },
  settings: {
    heading: 'Settings',
    summary: 'Configure AssessmentBot preferences and workspace options.',
  },
} as const;
