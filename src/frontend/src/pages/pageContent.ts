/**
 * Single source of truth for shell page headings, summaries, and shared page copy.
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
  classes: {
    heading: 'Classes',
    summary: 'Browse classes grouped by year group.',
  },
  heatmaps: {
    heading: 'Heatmaps',
    summary: 'Build task heatmaps by selecting a class, topics, and assignments.',
    noClassEmpty: 'Select a class to build a heatmap.',
    noAssignmentsEmpty: 'Select one or more assignments to build a heatmap.',
    selectionDisabledReason: 'Select a class first',
  },
  settings: {
    heading: 'Settings',
    summary: 'Configure AssessmentBot preferences and workspace options.',
  },
  classDetail: {
    heading: 'Class Overview',
    summary: 'Review assessment performance for this class.',
    recentAssignmentsEmpty: 'No recent assessments yet',
    searchEmpty: 'No students match your search',
    // Attempt-baseline mode-control copy (layout spec "Copy homes": header
    // copy lives here; consumed by ClassPageModeControl).
    modeControlLabel: 'Averages basis',
    absoluteModeOptionLabel: 'All tasks',
    baselineModeOptionLabel: 'Baseline tasks',
    baselineModeOptionTooltip:
      'Uses the tasks the ten-percent most-engaged students (minimum 2) have all attempted.',
  },
} as const;
