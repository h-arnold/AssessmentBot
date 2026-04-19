import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderNavigationPage } from '../navigation/appNavigation';
import { pageExpectations } from '../test/pageExpectations';
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
  it.each(pageExpectations)(
    'renders the expected heading and summary text for $heading',
    async ({ heading, key, summary }) => {
      renderWithFrontendProviders(<>{renderNavigationPage(key)}</>);

      expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    }
  );
});
