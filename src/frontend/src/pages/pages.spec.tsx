import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AppNavigationKey,
  renderNavigationPage,
} from '../navigation/appNavigation';
import { pageContent } from './pageContent';
import { HeatmapsPage } from './HeatmapsPage';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

const { getABClassPartialsMock, getCohortsMock, getGoogleClassroomsMock, getYearGroupsMock } = vi.hoisted(
  () => ({
    getABClassPartialsMock: vi.fn(),
    getCohortsMock: vi.fn(),
    getGoogleClassroomsMock: vi.fn(),
    getYearGroupsMock: vi.fn(),
  })
);

vi.mock('../features/settings/backend/BackendSettingsPanel', () => ({
  BackendSettingsPanel() {
    return <div>Backend settings feature entry</div>;
  },
}));

vi.mock('../services/googleClassrooms/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/googleClassrooms/googleClassroomsService', () => ({
  getGoogleClassrooms: getGoogleClassroomsMock,
}));

vi.mock('../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../features/taskHeatmap/HeatmapBuilderSurface', () => ({
  HeatmapBuilderSurface() {
    return <div data-testid="builder-surface-stub">Builder surface stub</div>;
  },
}));

const navigationPageExpectations = [
  { key: 'dashboard', ...pageContent.dashboard },
  { key: 'assignments', ...pageContent.assignments },
  { key: 'classes', ...pageContent.classes },
  { key: 'settings', ...pageContent.settings },
] as const satisfies ReadonlyArray<{ key: AppNavigationKey; heading: string; summary: string }>;

const classesManagementGoogleClassroom = [{ classId: 'class-1', className: 'Year 10 Maths' }];
const classesManagementClassPartial = [
  {
    classId: 'class-1',
    className: 'Year 10 Maths',
    cohortKey: 'cohort-2025',
    courseLength: 2,
    yearGroupKey: 'year-10',
    classOwner: null,
    teachers: [],
    active: true,
  },
];

beforeEach(() => {
  getABClassPartialsMock.mockResolvedValue(classesManagementClassPartial);
  getCohortsMock.mockResolvedValue([
    {
      key: 'cohort-2025',
      name: 'Cohort 2025',
      active: true,
      startYear: 2025,
      startMonth: 9,
    },
  ]);
  getGoogleClassroomsMock.mockResolvedValue(classesManagementGoogleClassroom);
  getYearGroupsMock.mockResolvedValue([
    {
      key: 'year-10',
      name: 'Year 10',
    },
  ]);
});

describe('page components', () => {
  it.each(navigationPageExpectations)(
    'renders the expected heading and summary text for $heading',
    async ({ heading, key, summary }) => {
      renderWithFrontendProviders(<>{renderNavigationPage(key)}</>);

      expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    }
  );
});

describe('heatmaps page copy and composition', () => {
  it('exposes pageContent.heatmaps heading and present summary copy', () => {
    const heatmaps = (
      pageContent as unknown as Record<string, { heading: string; summary: string }>
    ).heatmaps;

    expect(heatmaps?.heading).toBe('Heatmaps');
    const heatmapsSummary = heatmaps?.summary;
    expect(heatmapsSummary).toBeTruthy();
    expect(heatmapsSummary?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('renders the HeatmapsPage root composing only the taskHeatmap builder surface', () => {
    expect(HeatmapsPage).toBeDefined();

    renderWithFrontendProviders(<HeatmapsPage />);

    // The thin page root must mount the feature-owned builder surface and nothing else
    // at page level (composition boundary), per the HeatmapBuilderSurface contract.
    expect(screen.getByTestId('builder-surface-stub')).toBeInTheDocument();
    expect(screen.queryAllByTestId('builder-surface-stub')).toHaveLength(1);

    // Exclusivity: the thin page root must NOT emit page-level chrome (PageSection),
    // which renders an `app-page` section container and a level-2 heading. The heatmaps
    // page only composes the feature surface, so any such chrome leaked in would violate
    // the composition boundary.
    expect(document.querySelector('.app-page')).toBeNull();
  });
});
