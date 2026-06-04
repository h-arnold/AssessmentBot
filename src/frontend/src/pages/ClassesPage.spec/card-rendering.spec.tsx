/**
 * ClassesPage component tests - Class card rendering and placeholder action affordances
 *
 * Mandatory Reading (Files read):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-testing.md
 * - docs/developer/frontend/frontend-loading-and-width-standards.md
 * - docs/developer/frontend/frontend-react-query-and-prefetch.md
 * - src/frontend/src/features/auth/startupWarmupState.ts
 * - src/frontend/src/pages/AssignmentsPage.tsx
 * - src/frontend/src/pages/AssignmentsPage.spec.tsx
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/query/queryClient.ts
 * - src/frontend/src/test/renderWithFrontendProviders.tsx
 * - src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts
 * - src/frontend/src/pages/PageSection.tsx
 * - src/frontend/src/pages/classes/classesPageModel.ts
 * - src/frontend/src/test/classes/classesPageTestHelpers.ts
 */

import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ClassesPage } from '../ClassesPage';

import {
  renderClassesPage,
  verifyClassesPageModel,
  MOCK_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
  SINGLE_YEAR_GROUP,
} from '../../test/classes/classesPageTestHelpers';

import { createReadyWarmupState } from './shared-setup';

const {
  getABClassPartialsMock,
  getYearGroupsMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getAssignmentDefinitionPartialsMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  getABClassPartialsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getYearGroups: getYearGroupsMock,
  getCohorts: getCohortsMock,
}));

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

describe('ClassesPage', () => {
  beforeEach(() => {
    // Mock all service calls to prevent actual API calls
    getABClassPartialsMock.mockResolvedValue([]);
    getYearGroupsMock.mockResolvedValue([]);
    getCohortsMock.mockResolvedValue([]);
    getAssignmentTopicsMock.mockResolvedValue([]);
    getAssignmentDefinitionPartialsMock.mockResolvedValue([]);

    // Default to ready warmup state
    useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Owned-surface loading, blocking, and page-empty states', () => {
    describe('Section 5: Render class cards and placeholder action affordances', () => {
      // Test constants for magic numbers
      const EXPECTED_ALPHABETICAL_CLASSES_COUNT = 3;
      const EXPECTED_TIE_BREAK_CLASSES_COUNT = 3;
      const EXPECTED_BUTTONS_PER_CARD = 2; // Only View and Edit

      // Use shared fixtures from test helpers

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      });

      it('verifies card order inside a panel follows className then classId', () => {
        // Use shared helper for rendering with alphabetical order data
        renderClassesPage({
          classPartials: ALPHABETICAL_ORDER_CLASS_PARTIALS,
          yearGroups: MOCK_YEAR_GROUPS,
        });

        // Verify the view model sorts correctly
        const { modelResult, isInvalid } = verifyClassesPageModel(
          ALPHABETICAL_ORDER_CLASS_PARTIALS,
          MOCK_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: {
              yearGroupKey: string;
              classes: { classId: string; className: string; yearGroupKey: string; yearGroupLabel: string }[];
            }[];
          };

          const year10Panel = viewModel.panels.find(
            (p) => p.yearGroupKey === 'year-group-10'
          );
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_ALPHABETICAL_CLASSES_COUNT);

          // Expected order: English 10, Mathematics 10A, Mathematics 10B
          const expectedClasses = [
            { classId: 'class-english-10', className: 'English 10', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-math-10b', className: 'Mathematics 10B', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
          ];
          expect(year10Panel?.classes).toEqual(expectedClasses);
        }

        // Assert rendered cards match the sorted order
        const year10PanelRegion = screen.getByRole('region', { name: /year 10/i });
        expect(year10PanelRegion).toBeInTheDocument();

        const cards = year10PanelRegion.querySelectorAll('[role="article"]');
        expect(cards).toHaveLength(EXPECTED_ALPHABETICAL_CLASSES_COUNT);

        const cardTitles = [...cards].map((card) => card.getAttribute('aria-label'));
        expect(cardTitles).toEqual(['English 10', 'Mathematics 10A', 'Mathematics 10B']);
      });

      it('verifies card order uses classId as tie-break when className is identical', () => {
        // Use shared helper for rendering with tie-break data
        renderClassesPage({
          classPartials: TIE_BREAK_CLASS_PARTIALS,
          yearGroups: SINGLE_YEAR_GROUP,
        });

        // Verify the view model sorts by className then classId
        const { modelResult, isInvalid } = verifyClassesPageModel(
          TIE_BREAK_CLASS_PARTIALS,
          SINGLE_YEAR_GROUP
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: {
              yearGroupKey: string;
              classes: { classId: string; className: string; yearGroupKey: string; yearGroupLabel: string }[];
            }[];
          };

          const year10Panel = viewModel.panels.find(
            (p) => p.yearGroupKey === 'year-group-10'
          );
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_TIE_BREAK_CLASSES_COUNT);

          // Expected order: A Class, Z Class (with classId a-z), Z Class (with classId b-z)
          const expectedClasses = [
            { classId: 'class-b-a', className: 'A Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-a-z', className: 'Z Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-b-z', className: 'Z Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
          ];
          expect(year10Panel?.classes).toEqual(expectedClasses);
        }

        // Assert rendered order matches
        const year10PanelRegion = screen.getByRole('region', { name: /year 10/i });
        expect(year10PanelRegion).toBeInTheDocument();

        const cards = year10PanelRegion.querySelectorAll('[role="article"]');
        expect(cards).toHaveLength(EXPECTED_TIE_BREAK_CLASSES_COUNT);

        const cardTitles = [...cards].map((card) => card.getAttribute('aria-label'));
        expect(cardTitles).toEqual(['A Class', 'Z Class', 'Z Class']);
      });

      it('verifies both placeholder buttons are visible with correct enabled/disabled states for every rendered card', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...MOCK_CLASS_PARTIALS,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Find all View buttons - there should be one per card
        const viewButtons = screen.getAllByRole('button', { name: /view/i });
        expect(viewButtons.length).toBeGreaterThan(0);

        // Find all Assess Task buttons - there should be one per card
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        expect(assessTaskButtons.length).toBeGreaterThan(0);

        // Total cards = total View buttons = total Assess Task buttons
        const expectedCardCount = viewButtons.length;
        expect(assessTaskButtons.length).toBe(expectedCardCount);

        // Verify every View button is disabled and visible
        for (const viewButton of viewButtons) {
          expect(viewButton).toBeInTheDocument();
          expect(viewButton).toBeDisabled();
          expect(viewButton).toBeVisible();
        }

        // Verify every Assess Task button is enabled and visible
        for (const assessButton of assessTaskButtons) {
          expect(assessButton).toBeInTheDocument();
          expect(assessButton).toBeEnabled();
          expect(assessButton).toBeVisible();
        }
      });

      it('proves no extra metadata such as cohort, teacher list, or status chips is rendered in this iteration', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...MOCK_CLASS_PARTIALS,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Get all rendered cards
        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        // Expected: cards contain only className as title and View/Edit disabled buttons
        // No cohort, teacher, status, Google Classroom, or document type metadata
        const forbiddenPatterns = [
          /cohort/i,
          /teacher/i,
          /instructor/i,
          /active/i,
          /inactive/i,
          /google/i,
          /classroom/i,
          /slides/i,
          /document/i,
        ];

        for (const card of cards) {
          for (const pattern of forbiddenPatterns) {
            expect(card).not.toHaveTextContent(pattern);
          }

          // Verify View and Assess Task buttons are present
          const cardViewButtons = screen.getAllByRole('button', { name: /view/i });
          const cardAssessButtons = screen.getAllByRole('button', { name: 'Assess Task' });
          expect(cardViewButtons.length).toBeGreaterThan(0);
          expect(cardAssessButtons.length).toBeGreaterThan(0);
        }
      });

      it('proves no drag or reorder affordance is present', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...MOCK_CLASS_PARTIALS,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Get all rendered cards
        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        // Expected: cards have only View and Edit buttons, no drag/reorder affordances

        for (const card of cards) {
          // Should NOT contain drag handle
          expect(card).not.toHaveAttribute('draggable', 'true');
          expect(card).not.toHaveClass(/drag/);
          expect(card).not.toHaveClass(/draggable/);

          // Should NOT contain reorder/sort buttons or text
          expect(card).not.toHaveTextContent(/reorder/i);
          expect(card).not.toHaveTextContent(/move/i);
          expect(card).not.toHaveClass(/sort/);
          expect(card).not.toHaveClass(/handle/);

          // Check that the card has exactly View and Assess Task buttons
          const cardButtons = card.querySelectorAll('button');
          expect(cardButtons.length).toBe(EXPECTED_BUTTONS_PER_CARD);
          // The View button has textContent "View"
          expect(cardButtons[0]?.textContent).toMatch(/view/i);
          // The Assess Task button is icon-only; its accessible name is "Assess Task"
          expect(cardButtons[1]?.getAttribute('aria-label')).toBe('Assess Task');
        }

        // Also verify the card region wrapper has no drag/reorder classes
        const cardRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(cardRegion).not.toHaveClass(/drag/);
        expect(cardRegion).not.toHaveClass(/draggable/);
        expect(cardRegion).not.toHaveClass(/sort/);
      });

      // ==========================================================================
      // Section 4 Red: Assess Task button replacement tests
      // These verify that the Edit button is replaced by an Assess Task icon
      // button. They SHOULD FAIL in the RED phase because the replacement has
      // not been implemented yet. The production code still renders "Edit"
      // buttons, so assertions that target "Assess Task" buttons will fail.
      // ==========================================================================

      it('replaces Edit button with Assess Task icon button on every card', () => {
        renderClassesPage();

        // Edit buttons should no longer exist — FAILS because production code still has Edit
        const editButtons = screen.queryAllByRole('button', { name: /edit/i });
        expect(editButtons).toHaveLength(0);

        // Assess Task buttons should exist on every card — FAILS because not implemented yet
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        const cards = screen.getAllByRole('article');
        expect(assessTaskButtons.length).toBe(cards.length);
        expect(assessTaskButtons.length).toBeGreaterThan(0);

        // EXPECTED_BUTTONS_PER_CARD stays at 2 (View + Assess Task)
        const BUTTONS_PER_CARD_CONTRACT = 2;
        expect(EXPECTED_BUTTONS_PER_CARD).toBe(BUTTONS_PER_CARD_CONTRACT);
      });

      it('keeps View button disabled and unchanged', () => {
        renderClassesPage();

        const viewButtons = screen.getAllByRole('button', { name: /view/i });
        expect(viewButtons.length).toBeGreaterThan(0);

        for (const viewButton of viewButtons) {
          expect(viewButton).toBeVisible();
          expect(viewButton).toBeDisabled();
        }
      });

      it('renders Assess Task buttons with aria-label="Assess Task"', () => {
        renderClassesPage();

        // FAILS because no "Assess Task" buttons exist yet in production code
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        expect(assessTaskButtons.length).toBeGreaterThan(0);

        for (const button of assessTaskButtons) {
          // Icon-only button must carry aria-label as its accessible name
          expect(button).toHaveAttribute('aria-label', 'Assess Task');
          // The button should be enabled (not disabled like the old Edit button)
          expect(button).toBeEnabled();
          expect(button).toBeVisible();
        }
      });

      it('maintains card width at 268 px max-width with the new icon button', () => {
        const MAX_CARD_WIDTH_PX = 268;
        renderClassesPage();

        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        for (const card of cards) {
          // JSDOM getComputedStyle may not resolve inline styles; check inline style as fallback
          const { maxWidth } = globalThis.getComputedStyle(card);
          let maxWidthPx: number;
          if (maxWidth && maxWidth !== 'none') {
            maxWidthPx = Number.parseInt(maxWidth, 10);
          } else {
            const inlineMaxWidth = (card as HTMLElement).style.maxWidth;
            maxWidthPx = inlineMaxWidth && inlineMaxWidth !== 'none'
              ? Number.parseInt(inlineMaxWidth, 10)
              : Number.POSITIVE_INFINITY;
          }
          expect(maxWidthPx).toBeLessThanOrEqual(MAX_CARD_WIDTH_PX);
        }
      });
    });
  });
});
