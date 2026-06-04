/**
 * Type definitions for the Assignment Definition Wizard Modal test helpers.
 */

import type { FrontendProvidersOptions } from '../../renderWithFrontendProviders';
import type { TestRenderResult } from '../wizardTestHelpers';
import type { AssignmentDefinition } from '../../../services/assignmentDefinition.zod';

/**
 * Mode type for the wizard modal.
 */
export type WizardModalMode = 'create' | 'update';

/**
 * Options for rendering the assignment definition wizard modal.
 */
export interface RenderWizardModalOptions {
  /** The modal mode (create or update). */
  mode: WizardModalMode;
  /** The definition key (null for create mode). */
  definitionKey: string | null;
  /** Optional onClose handler. */
  onClose?: () => void;
  /** Whether the modal is open. */
  open?: boolean;
  /** Optional mock topics to use. */
  topics?: unknown[];
  /** Optional mock year groups to use. */
  yearGroups?: unknown[];
  /** Optional mock cohorts to use. */
  cohorts?: unknown[];
  /** Optional mock assignment definition for update mode. */
  assignmentDefinition?: AssignmentDefinition;
  /** Optional flag to mock invalidateQueries (default: true). */
  mockInvalidateQueries?: boolean;
  /** Optional warmup state override. */
  warmupState?: FrontendProvidersOptions['warmupState'];
  /** Whether to wait for the interactive form fields (default: true). */
  waitForFormFields?: boolean;
}

/**
 * Result of rendering the wizard modal with test utilities.
 */
export interface WizardModalRenderResult extends TestRenderResult {
  /** The rendered modal element. */
  modal: HTMLElement;
}

/**
 * Container for modal element queries.
 */
export interface ModalElementQueries {
  modal: HTMLElement;
}

/**
 * Options for filling required fields in the wizard form.
 */
export interface FillRequiredFieldsOptions {
  /** The title to set (default: 'Test Assessment'). */
  title?: string;
  /** The reference URL to set (default: 'https://docs.google.com/presentation/d/test-ref'). */
  referenceUrl?: string;
  /** The template URL to set (default: 'https://docs.google.com/presentation/d/test-tpl'). */
  templateUrl?: string;
  /** The topic to select (default: 'Algebra'). */
  topic?: string | RegExp;
  /** The year group to select (default: 'Year 10'). */
  yearGroup?: string | RegExp;
}
