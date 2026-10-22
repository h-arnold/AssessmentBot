import { vi } from 'vitest';
import { useStartupWarmupState } from '@/features/auth/startupWarmupState';
import { getABClassPartials } from '@/services/googleClassrooms/classPartialsService';
import { getYearGroups, getCohorts } from '@/services/referenceData/referenceDataService';
import { getAssignmentTopics } from '@/services/assignmentDefinition/assignmentTopicsService';
import { getAssignmentDefinitionPartials } from '@/services/assignmentDefinition/assignmentDefinitionPartialsService';
import { ClassPage } from '@/features/classPage/ClassPage';
import { useClassSelection } from '@/ClassSelectionContext';
import { createReadyWarmupState } from './classesPageWarmupFixtures';

export const useStartupWarmupStateMock = vi.mocked(useStartupWarmupState);
export const mockClassPage = vi.mocked(ClassPage);
export const mockUseClassSelection = vi.mocked(useClassSelection);

/** Seeds isolated service and selection doubles before rendering each test. */
export function resetClassesPageComponentMocks(): void {
  vi.mocked(getABClassPartials).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getYearGroups).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getCohorts).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getAssignmentTopics).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getAssignmentDefinitionPartials).mockImplementation(() => Promise.resolve([]));
  useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
  mockUseClassSelection.mockReturnValue({
    selectedClassId: null,
    className: null,
    onSelectClass: vi.fn(),
    onNavigateToClasses: vi.fn(),
  });
}
