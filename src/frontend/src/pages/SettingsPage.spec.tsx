import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

const backendSettingsFeatureEntryText = 'Backend settings feature entry';
const backendSettingsFeatureEntryRegionLabel = 'Backend settings feature entry';

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
    return (
      <div role="region" aria-label={backendSettingsFeatureEntryRegionLabel}>
        {backendSettingsFeatureEntryText}
      </div>
    );
  },
}));

vi.mock('../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/googleClassroomsService', () => ({
  getGoogleClassrooms: getGoogleClassroomsMock,
}));

vi.mock('../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

const classesManagementGoogleClassroom = [{ classId: 'class-1', className: 'Year 10 Maths' }];
const classesManagementClassPartial = [
  {
    classId: 'class-1',
    className: 'Year 10 Maths',
    cohortKey: 'cohort-2025',
    cohortLabel: null,
    courseLength: 2,
    yearGroupKey: 'year-10',
    yearGroupLabel: null,
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('SettingsPage', () => {
  const renderSettingsPage = (queryClient = createAppQueryClient()) => {
    const prefetchQuerySpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockImplementation(() => Promise.resolve());

    return {
      prefetchQuerySpy,
      ...renderWithFrontendProviders(<SettingsPage />, { queryClient }),
    };
  };

  it('renders the shared settings heading and summary copy', () => {
    renderSettingsPage();

    expect(
      screen.getByRole('heading', { level: 2, name: pageContent.settings.heading })
    ).toBeInTheDocument();
    expect(screen.getByText(pageContent.settings.summary)).toBeInTheDocument();
  });

  it('renders the backend settings feature entry when the tab is selected', () => {
    renderSettingsPage();

    const classesTab = screen.getByRole('tab', { name: 'Classes' });
    const backendSettingsTab = screen.getByRole('tab', { name: 'Backend settings' });

    expect(classesTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(backendSettingsTab);

    expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('region', { name: backendSettingsFeatureEntryRegionLabel })
    ).toBeInTheDocument();
    expect(screen.getByText(backendSettingsFeatureEntryText)).toBeInTheDocument();
  });

  it('resets the Classes selection when leaving and re-entering the tab', async () => {
    renderSettingsPage();

    const classesTable = await screen.findByRole('table', { name: 'Classes table' });
    fireEvent.click(within(classesTable).getAllByRole('checkbox')[1]);

    await waitFor(() => {
      expect(screen.getByText('Selected rows: 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Backend settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Classes' }));

    await waitFor(() => {
      expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
    });
  });

  it('prefetches Google Classrooms on page load without blocking the initial classes tab render', async () => {
    const queryClient = createAppQueryClient();
    const { prefetchQuerySpy } = renderSettingsPage(queryClient);

    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Bulk actions')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
    expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();

    await waitFor(() => {
      expect(prefetchQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.any(Array),
          queryFn: expect.any(Function),
        })
      );
    });
  });
});
