import { expect, type Locator, type Page } from '@playwright/test';
import {
  selectVisibleOption,
  waitForAssignmentsPageReady,
  type ResponseItem,
  type RuntimeScenario,
} from '../shared/endToEndRuntimeMocks';
import editableDefinitionsRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json';
import assignmentDefinitionPartialsRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentDefinitionPartials.json';
import classPartialsRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/classPartials.json';

// ============================================================================
// Canonical fixture shapes and loading
// ============================================================================
//
// Scenario content is seeded from the committed canonical `small` profile
// transport views (`transport.editableDefinitions` plus the full-definition
// rows of the partials view and a trustworthy class row), per the ACTION_PLAN
// canonical-fixture policy. No hand-built realistic corpus is introduced.

/**
 * Lightweight task row carried by a canonical full definition.
 */
type CanonicalTask = Readonly<{
  taskId: string;
  taskTitle: string;
  taskWeighting: number;
}>;

/**
 * Full editable-definition transport record (subset used by the journeys).
 */
type CanonicalDefinition = Readonly<{
  definitionKey: string;
  primaryTitle: string;
  primaryTopic: string;
  primaryTopicKey: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  documentType: string;
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number;
  tasks: ReadonlyArray<CanonicalTask>;
}>;

/**
 * Trustworthy class partial row (non-null class name and year group key).
 */
type CanonicalClassPartial = Readonly<{
  classId: string;
  className: string;
  yearGroupKey: string;
  cohortKey: string | null;
  courseLength: number;
  classOwner: unknown;
  teachers: ReadonlyArray<unknown>;
  active: boolean | null;
}>;

const editableDefinitions = editableDefinitionsRaw as unknown as Record<
  string,
  CanonicalDefinition
>;
const assignmentDefinitionPartials = assignmentDefinitionPartialsRaw as unknown as ReadonlyArray<
  Record<string, unknown>
>;

/**
 * Selects the canonical trustworthy class row from the committed profile.
 *
 * The Classes page fails closed when any class partial has a null class name or
 * year group key, so the row is programme-selected from the fixture rather than
 * pinned to a generated fixture key.
 *
 * @returns {CanonicalClassPartial} The first trustworthy class partial.
 */
function selectCanonicalClassRow(): CanonicalClassPartial {
  const candidate = classPartialsRaw.find(
    (row) => row.className != null && row.yearGroupKey != null
  );
  if (!candidate) {
    throw new Error('The canonical small profile has no trustworthy class row.');
  }
  return candidate as unknown as CanonicalClassPartial;
}

/**
 * Selects the canonical full definition whose year group matches the
 * trustworthy class row, so the Classes page panels and the definition
 * partials agree on the same year group.
 *
 * @param {CanonicalClassPartial} classRow The selected canonical class row.
 * @returns {CanonicalDefinition} The matching full editable definition.
 */
function selectCanonicalDefinition(classRow: CanonicalClassPartial): CanonicalDefinition {
  const candidate = Object.values(editableDefinitions).find(
    (definition) => definition.yearGroupKey === classRow.yearGroupKey
  );
  if (!candidate) {
    throw new Error(
      `The canonical small profile has no full definition for year group ${classRow.yearGroupKey}.`
    );
  }
  return candidate;
}

const canonicalClass = selectCanonicalClassRow();
const canonicalDefinition = selectCanonicalDefinition(canonicalClass);

/** Canonical full definition exercised as the stale/reparsed/reviewed definition. */
export const CANONICAL_RECOVERY_DEFINITION: CanonicalDefinition = canonicalDefinition;

/** Canonical trustworthy class row used internally by the Classes-page journeys. */
const CANONICAL_RECOVERY_CLASS: CanonicalClassPartial = canonicalClass;

/** Canonical full-definition partials view returned internally by the warm-up query. */
const CANONICAL_DEFINITION_PARTIALS: ReadonlyArray<Record<string, unknown>> =
  assignmentDefinitionPartials;

// ============================================================================
// Derived reference data (no invented corpus)
// ============================================================================

/** A single canonical reference-data option. */
export type CanonicalReferenceOption = Readonly<{ key: string; name: string }>;

/**
 * Builds topic and year-group reference data from the canonical full definitions.
 *
 * @returns {{ topics: Array<CanonicalReferenceOption & { yearGroupKeys: string[] }>; yearGroups: CanonicalReferenceOption[] }} Derived reference data.
 */
function buildCanonicalReferenceData(): {
  topics: Array<CanonicalReferenceOption & { yearGroupKeys: string[] }>;
  yearGroups: CanonicalReferenceOption[];
} {
  const topics: Array<CanonicalReferenceOption & { yearGroupKeys: string[] }> = [];
  const yearGroups: CanonicalReferenceOption[] = [];
  const seenTopics = new Set<string>();
  const seenYearGroups = new Set<string>();

  for (const definition of Object.values(editableDefinitions)) {
    if (!seenTopics.has(definition.primaryTopicKey)) {
      seenTopics.add(definition.primaryTopicKey);
      topics.push({
        key: definition.primaryTopicKey,
        name: definition.primaryTopic,
        yearGroupKeys: [definition.yearGroupKey],
      });
    }
    if (!seenYearGroups.has(definition.yearGroupKey)) {
      seenYearGroups.add(definition.yearGroupKey);
      yearGroups.push({ key: definition.yearGroupKey, name: definition.yearGroupLabel });
    }
  }

  return { topics, yearGroups };
}

const referenceData = buildCanonicalReferenceData();

/** Canonical topics view derived from the full definitions. */
export const CANONICAL_TOPICS = referenceData.topics;

/** Canonical year-groups view derived from the full definitions. */
export const CANONICAL_YEAR_GROUPS = referenceData.yearGroups;

// ============================================================================
// Journey assignments and document URLs
// ============================================================================

/**
 * Assignment that matches the canonical definition (title, topic and year group).
 */
export const MATCHED_ASSIGNMENT = {
  assignmentId: 'cw-1',
  title: CANONICAL_RECOVERY_DEFINITION.primaryTitle,
  topicId: CANONICAL_RECOVERY_DEFINITION.primaryTopicKey,
  topicName: CANONICAL_RECOVERY_DEFINITION.primaryTopic,
} as const;

/**
 * Assignment that matches no definition partial, forcing the create choice prompt.
 */
export const CREATE_ASSIGNMENT = {
  ...MATCHED_ASSIGNMENT,
  title: `${CANONICAL_RECOVERY_DEFINITION.primaryTitle} (new)`,
} as const;

/** Google Docs URL path segment per canonical document type (matches `buildCanonicalUrl`). */
const DOCUMENT_URL_PATH_SEGMENT: Readonly<Record<string, string>> = {
  SLIDES: 'presentation',
  SHEETS: 'spreadsheets',
};

/**
 * Builds the canonical document URL for a definition's document id.
 *
 * @param {string} documentId The canonical document identifier.
 * @returns {string} The canonical document URL.
 */
function buildCanonicalDocumentUrl(documentId: string): string {
  const pathSegment = DOCUMENT_URL_PATH_SEGMENT[CANONICAL_RECOVERY_DEFINITION.documentType];
  if (!pathSegment) {
    throw new Error(
      `Unsupported canonical document type ${CANONICAL_RECOVERY_DEFINITION.documentType}.`
    );
  }
  return `https://docs.google.com/${pathSegment}/d/${documentId}/edit`;
}

/** Canonical reference document URL derived from the definition's document id. */
export const CANONICAL_REFERENCE_URL = buildCanonicalDocumentUrl(
  CANONICAL_RECOVERY_DEFINITION.referenceDocumentId
);

/** Canonical template document URL derived from the definition's document id. */
export const CANONICAL_TEMPLATE_URL = buildCanonicalDocumentUrl(
  CANONICAL_RECOVERY_DEFINITION.templateDocumentId
);

// ============================================================================
// Shared copy and action-name constants
// ============================================================================

/** Visible action names shared across the journeys. */
export const ACTION_CANCEL = 'Cancel';
export const ACTION_UPDATE = 'Update';
export const ACTION_SAVE = 'Save';
export const ACTION_RETRY = 'Retry';
export const ACTION_CREATE = 'Create New Definition';
export const ACTION_START_ASSESSMENT = 'Start Assessment';
export const ACTION_REPARSE_DOCUMENTS = 'Reparse documents';
export const ACTION_PARSE_AND_CONTINUE = 'Parse and continue';

/** Accessible name of the task weightings table. */
export const TASK_WEIGHTINGS_TABLE = 'Task weightings';

/** Exact `DEFINITION_STALE` registry copy (source: `errors/map-error-to-ui.ts`). */
export const STALE_PROMPT_COPY =
  'This assessment definition is out of date. Please review the linked documents and try again.';

/** Exact `DEFINITION_PARSE_FAILED` registry copy (source: `errors/map-error-to-ui.ts`). */
export const PARSE_FAILED_COPY =
  'The assignment documents could not be parsed. Check the reference and template documents, then try again.';

/** Exact review-surface caveat copy (source: `AssessTaskRecoverySurface.tsx`). */
export const REVIEW_CAVEAT_COPY =
  'Reparsing has already refreshed the stored definition. Cancelling review discards only unsaved edits.';

/** Visible disabled explanation for the Reparse documents action. */
export const REPARSE_DISABLED_EXPLANATION =
  'Save or discard your edits before reparsing the documents.';

// ============================================================================
// Runtime scenario factory
// ============================================================================

/**
 * Optional per-method queue overrides for a stale-recovery journey scenario.
 */
export type StaleRecoveryScenarioOverrides = Readonly<{
  startAssessmentRun?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinitionPartials?: ReadonlyArray<ResponseItem>;
}>;

/** Startup/reference-data queue sizes (extra entries are harmless, missing ones are not). */
const STARTUP_QUEUE_REPEATS = 3;
const REFERENCE_DATA_QUEUE_REPEATS = 10;
const DEFINITION_PARTIALS_QUEUE_REPEATS = 12;
const READ_QUEUE_REPEATS = 8;

/**
 * Builds a success response entry.
 *
 * @param {unknown} data The response payload.
 * @returns {ResponseItem} The success entry.
 */
function success(data: unknown): ResponseItem {
  return { kind: 'success', data };
}

/**
 * Repeats one response entry into a fresh array.
 *
 * @param {ResponseItem} entry The response entry to repeat.
 * @param {number} count The number of copies.
 * @returns {ResponseItem[]} The repeated entries.
 */
function repeat(entry: ResponseItem, count: number): ResponseItem[] {
  return Array.from({ length: count }, () => ({ ...entry }));
}

/**
 * Builds the canonical base scenario queues shared by every stale-recovery journey.
 *
 * @param {ReadonlyArray<unknown>} assignments The classroom assignments to return.
 * @returns {RuntimeScenario} The base scenario.
 */
function buildCanonicalScenario(assignments: ReadonlyArray<unknown>): RuntimeScenario {
  return {
    getAuthorisationStatus: repeat(success(true), STARTUP_QUEUE_REPEATS),
    getApplicationAccess: repeat(
      success({ allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' }),
      STARTUP_QUEUE_REPEATS
    ),
    getABClassPartials: repeat(success([CANONICAL_RECOVERY_CLASS]), REFERENCE_DATA_QUEUE_REPEATS),
    getCohorts: repeat(success([]), READ_QUEUE_REPEATS),
    getYearGroups: repeat(success(CANONICAL_YEAR_GROUPS), REFERENCE_DATA_QUEUE_REPEATS),
    getAssignmentTopics: repeat(success(CANONICAL_TOPICS), REFERENCE_DATA_QUEUE_REPEATS),
    getGoogleClassroomAssignments: repeat(success(assignments), READ_QUEUE_REPEATS),
    getAssignmentDefinitionPartials: repeat(
      success(CANONICAL_DEFINITION_PARTIALS),
      DEFINITION_PARTIALS_QUEUE_REPEATS
    ),
    getAssignmentDefinition: repeat(success(CANONICAL_RECOVERY_DEFINITION), READ_QUEUE_REPEATS),
    startAssessmentRun: repeat(success(null), READ_QUEUE_REPEATS),
    upsertAssignmentDefinition: repeat(success(CANONICAL_RECOVERY_DEFINITION), READ_QUEUE_REPEATS),
    deleteAssignmentDefinition: repeat(success(null), STARTUP_QUEUE_REPEATS),
  };
}

/**
 * Creates a StrictMode-safe runtime scenario for the stale-recovery journeys,
 * seeded from the canonical `small` profile transport views.
 *
 * @param {ReadonlyArray<unknown>} [assignments] Classroom assignments for the journey.
 * @param {StaleRecoveryScenarioOverrides} [overrides] Per-method queue overrides for the journey.
 * @returns {RuntimeScenario} The configured runtime scenario.
 */
export function createStaleRecoveryScenario(
  assignments: ReadonlyArray<unknown> = [MATCHED_ASSIGNMENT],
  overrides: StaleRecoveryScenarioOverrides = {}
): RuntimeScenario {
  const base = buildCanonicalScenario(assignments);
  return { ...base, ...overrides };
}

// ============================================================================
// Page navigation helpers
// ============================================================================

/** Panel selector for the canonical class year group (Year 9). */
const CANONICAL_YEAR_GROUP_PANEL = `#panel-content-${CANONICAL_RECOVERY_CLASS.yearGroupKey}`;

/** Bounded attempts to open a modal whose trigger can be missed mid-animation. */
const MODAL_OPEN_ATTEMPTS = 3;

/** Per-attempt wait for the dialog before re-clicking the trigger. */
const MODAL_OPEN_RETRY_TIMEOUT_MS = 2000;

/**
 * Clicks a modal trigger until the expected dialog becomes visible.
 *
 * @remarks
 * Ant Design's collapse animation can settle between Playwright's stability
 * frames under load, so a single click on a freshly revealed control can
 * occasionally be missed. The trigger is re-clicked a bounded number of times;
 * if the dialog still never appears the helper rethrows with the last timeout
 * as the cause rather than swallowing the failure.
 *
 * @param {Page} page The Playwright page under test.
 * @param {Locator} trigger The modal-opening control.
 * @returns {Promise<Locator>} The visible dialog locator.
 */
async function clickUntilDialogVisible(page: Page, trigger: Locator): Promise<Locator> {
  const dialog = page.getByRole('dialog');
  let lastError: unknown;

  for (let attempt = 0; attempt < MODAL_OPEN_ATTEMPTS; attempt += 1) {
    if (await dialog.isVisible()) {
      return dialog;
    }

    await trigger.click();

    try {
      await dialog.waitFor({ state: 'visible', timeout: MODAL_OPEN_RETRY_TIMEOUT_MS });
      return dialog;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`The expected dialog did not open after ${MODAL_OPEN_ATTEMPTS} attempts.`, {
    cause: lastError,
  });
}

/**
 * Navigates to the Classes page, expands the canonical Year 9 panel, and opens
 * the Assess Task modal for the canonical class.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<Locator>} The visible owning dialog locator.
 */
export async function openCanonicalAssessTaskModal(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  await expect(page.locator(CANONICAL_YEAR_GROUP_PANEL)).not.toBeVisible();
  await page
    .getByRole('heading', { level: 3, name: CANONICAL_RECOVERY_DEFINITION.yearGroupLabel })
    .click();
  const panel = page.locator(CANONICAL_YEAR_GROUP_PANEL);
  await expect(panel).toBeVisible();
  const assessTaskButton = panel.getByRole('button', { name: 'Assess Task' }).first();
  await expect(assessTaskButton).toBeEnabled();
  return await clickUntilDialogVisible(page, assessTaskButton);
}

/**
 * Navigates to the Assignments page and opens the update wizard for the
 * canonical definition.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<Locator>} The visible update dialog locator.
 */
export async function openCanonicalUpdateModal(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  await waitForAssignmentsPageReady(page);
  const table = page.getByRole('table', { name: 'Assignment definitions table' });
  const row = table
    .locator('tbody tr')
    .filter({ hasText: CANONICAL_RECOVERY_DEFINITION.primaryTitle });
  await row.getByRole('button', { name: ACTION_UPDATE }).click();
  const dialog = page.getByRole('dialog', { name: 'Update assignment' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Selects a classroom assignment in the Assess Task modal and starts the
 * assessment.
 *
 * @param {Locator} dialog The owning dialog locator.
 * @param {Page} page The Playwright page under test.
 * @param {string} assignmentTitle The visible assignment option label.
 * @returns {Promise<void>} Resolves once the start action is triggered.
 */
export async function selectCanonicalAssignmentAndStart(
  dialog: Locator,
  page: Page,
  assignmentTitle: string
): Promise<void> {
  await dialog.getByTestId('assignment-select').click();
  await selectVisibleOption(page, assignmentTitle);
  await dialog.getByRole('button', { name: ACTION_START_ASSESSMENT }).click();
}
