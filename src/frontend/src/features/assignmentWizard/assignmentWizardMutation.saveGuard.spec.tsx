/**
 * Direct behaviour coverage for the wizard mutation boundary's pending-change
 * Save guard.
 *
 * `useWizardMutationSequence` rejects a `save` before transport while a document
 * change is pending. The rendered Save action is already disabled in that state,
 * so the modal suites can only observe the guard indirectly through the disabled
 * control — deleting the guard outright would leave every one of them passing.
 * These tests drive the real hook directly, with no rendered button anywhere in
 * the tree, so the boundary is exercised on its own terms.
 *
 * The contract pinned here is deliberately narrow: only `save` is blocked by a
 * pending document change, because `parse` and `reparse` are precisely the
 * actions that resolve one.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { Form, type FormInstance } from 'antd';
import { act, renderHook } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createAppQueryClient } from '../../query/queryClient';
import { upsertAssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinitionService';
import type {
  UpsertAssignmentDefinitionRequest,
  UpsertAssignmentDefinitionResponse,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { useWizardMutationSequence } from './assignmentWizardMutation';
import type { WizardMutationSequenceOptions } from './assignmentWizardMutation';
import { buildReparseRequest } from './assignmentWizardOrchestrator';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  upsertAssignmentDefinition: vi.fn(),
}));

/** Transport mock for the single boundary under test. */
const upsertMock = vi.mocked(upsertAssignmentDefinition);

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture rather than a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical definition, used both as the saved record and as the mutation response. */
const CANONICAL_DEFINITION: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/** Definition key every mutation in this suite is issued against. */
const DEFINITION_KEY = CANONICAL_DEFINITION.definitionKey;

/** Canonical reference URL, reconstructed from the fixture's document ID and type. */
const PERSISTED_REFERENCE_URL =
  'https://docs.google.com/presentation/d/reference-document-0/edit';

/** Canonical template URL, reconstructed from the fixture's document ID and type. */
const PERSISTED_TEMPLATE_URL = 'https://docs.google.com/presentation/d/template-document-0/edit';

/** Document URLs standing in for the user edit that is awaiting re-parse. */
const PENDING_DOCUMENT_URLS = {
  referenceDocumentUrl: 'https://docs.google.com/presentation/d/pending-reference/edit',
  templateDocumentUrl: 'https://docs.google.com/presentation/d/pending-template/edit',
} as const;

/** Persisted document URLs the boundary restores once a change is resolved. */
const RESOLVED_DOCUMENT_CHANGE = {
  hasPendingChange: false,
  previousReferenceUrl: PERSISTED_REFERENCE_URL,
  previousTemplateUrl: PERSISTED_TEMPLATE_URL,
};

/** One boundary render, with the hook result and every transition spy it drives. */
interface SequenceRender {
  /** The live hook result, so `result.current` always reads the latest render. */
  result: RenderHookResult<ReturnType<typeof useWizardMutationSequence>, unknown>['result'];
  onClose: ReturnType<typeof vi.fn>;
  setTaskRows: ReturnType<typeof vi.fn>;
  setHasParsedTasks: ReturnType<typeof vi.fn>;
  setDocumentChange: ReturnType<typeof vi.fn>;
  setLocalDefinitionKey: ReturnType<typeof vi.fn>;
  setHasDirtyEdits: ReturnType<typeof vi.fn>;
  setSubmitBlockingError: ReturnType<typeof vi.fn>;
}

/**
 * Renders the real mutation-sequence hook behind a connected form and query client.
 *
 * The provider wrapper owns the form instance so `applyParseResponseToForm` writes
 * to a form that is genuinely mounted; an unconnected `useForm` instance makes
 * rc-field-form log an "Instance created by `useForm` is not connected" warning.
 *
 * @param {Partial<WizardMutationSequenceOptions>} [overrides={}] Sequence-option overrides.
 * @returns {SequenceRender} The hook result and the transition spies it drives.
 */
function renderSequence(overrides: Partial<WizardMutationSequenceOptions> = {}): SequenceRender {
  const queryClient = createAppQueryClient();
  const mountedForm: { current: FormInstance | null } = { current: null };
  const onClose = vi.fn();
  const setTaskRows = vi.fn();
  const setHasParsedTasks = vi.fn();
  const setDocumentChange = vi.fn();
  const setLocalDefinitionKey = vi.fn();
  const setHasDirtyEdits = vi.fn();
  const setSubmitBlockingError = vi.fn();

  /**
   * Supplies the query client and the mounted form the boundary writes into.
   *
   * @param {Readonly<PropsWithChildren>} properties Provider properties.
   * @param {React.ReactNode} properties.children The hook under test.
   * @returns {React.JSX.Element} The provider tree.
   */
  function SequenceProviders({ children }: Readonly<PropsWithChildren>) {
    const [form] = Form.useForm();
    mountedForm.current = form;
    return (
      <QueryClientProvider client={queryClient}>
        <Form form={form}>{children}</Form>
      </QueryClientProvider>
    );
  }

  const { result } = renderHook(
    () =>
      useWizardMutationSequence({
        mode: 'update',
        // The wrapper renders before the hook body, so the form is mounted by now.
        form: mountedForm.current!,
        isDocumentChangePending: false,
        taskRows: [],
        localDefinitionKey: null,
        onClose,
        storeParseBaseline: vi.fn(),
        setTaskRows,
        setHasParsedTasks,
        setDocumentChange,
        setLocalDefinitionKey,
        setHasDirtyEdits,
        setSubmitBlockingError,
        ...overrides,
      }),
    { wrapper: SequenceProviders }
  );

  return {
    result,
    onClose,
    setTaskRows,
    setHasParsedTasks,
    setDocumentChange,
    setLocalDefinitionKey,
    setHasDirtyEdits,
    setSubmitBlockingError,
  };
}

/**
 * Builds a save request that still carries the unresolved document edit.
 *
 * @returns {UpsertAssignmentDefinitionRequest} The staged-save payload.
 */
function buildPendingSaveRequest(): UpsertAssignmentDefinitionRequest {
  return {
    primaryTitle: CANONICAL_DEFINITION.primaryTitle,
    primaryTopicKey: CANONICAL_DEFINITION.primaryTopicKey,
    yearGroupKey: CANONICAL_DEFINITION.yearGroupKey,
    ...PENDING_DOCUMENT_URLS,
    definitionKey: DEFINITION_KEY,
  };
}

/**
 * Builds a save request whose documents already match the persisted baseline.
 *
 * @returns {UpsertAssignmentDefinitionRequest} The settled-save payload.
 */
function buildSettledSaveRequest(): UpsertAssignmentDefinitionRequest {
  return {
    primaryTitle: CANONICAL_DEFINITION.primaryTitle,
    primaryTopicKey: CANONICAL_DEFINITION.primaryTopicKey,
    yearGroupKey: CANONICAL_DEFINITION.yearGroupKey,
    referenceDocumentUrl: PERSISTED_REFERENCE_URL,
    templateDocumentUrl: PERSISTED_TEMPLATE_URL,
    definitionKey: DEFINITION_KEY,
  };
}

beforeEach(() => {
  upsertMock.mockImplementation(() => Promise.resolve(CANONICAL_DEFINITION));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('wizard mutation boundary pending-change save guard', () => {
  it('rejects a save before transport while a document change is pending', async () => {
    const { result, onClose, setSubmitBlockingError } = renderSequence({
      isDocumentChangePending: true,
    });

    let outcome: UpsertAssignmentDefinitionResponse | undefined = CANONICAL_DEFINITION;
    await act(async () => {
      outcome = await result.current.runWizardMutation({
        actionType: 'save',
        request: buildPendingSaveRequest(),
        definitionKey: DEFINITION_KEY,
      });
    });

    expect(upsertMock).not.toHaveBeenCalled();
    expect(outcome).toBeUndefined();
    // A rejected save short-circuits silently: no transport error, no dismissal.
    expect(setSubmitBlockingError).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets a save reach transport when no document change is pending', async () => {
    const { result, onClose } = renderSequence({ isDocumentChangePending: false });

    let outcome: UpsertAssignmentDefinitionResponse | undefined = CANONICAL_DEFINITION;
    await act(async () => {
      outcome = await result.current.runWizardMutation({
        actionType: 'save',
        request: buildSettledSaveRequest(),
        definitionKey: DEFINITION_KEY,
      });
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      definitionKey: DEFINITION_KEY,
      primaryTitle: CANONICAL_DEFINITION.primaryTitle,
    });
    expect(outcome).toBeUndefined();
    // An accepted update-mode save hands control back by closing the wizard.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports an accepted create-mode save through onCreateSuccess', async () => {
    const onCreateSuccess = vi.fn();
    const { result, onClose } = renderSequence({
      mode: 'create',
      isDocumentChangePending: false,
      onCreateSuccess,
    });

    await act(async () => {
      await result.current.runWizardMutation({
        actionType: 'save',
        request: buildSettledSaveRequest(),
        definitionKey: null,
      });
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(onCreateSuccess).toHaveBeenCalledWith(DEFINITION_KEY);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps parse reaching transport while a document change is pending', async () => {
    const { result, setHasParsedTasks, setDocumentChange, setLocalDefinitionKey, setHasDirtyEdits } =
      renderSequence({ isDocumentChangePending: true });

    let outcome: UpsertAssignmentDefinitionResponse | undefined;
    await act(async () => {
      outcome = await result.current.runWizardMutation({
        actionType: 'parse',
        request: { ...buildPendingSaveRequest(), definitionKey: undefined },
        definitionKey: null,
      });
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    // Parse is the action that resolves a pending change, so its response lands.
    expect(outcome).toBe(CANONICAL_DEFINITION);
    expect(setHasParsedTasks).toHaveBeenCalledWith(true);
    expect(setDocumentChange).toHaveBeenCalledWith(RESOLVED_DOCUMENT_CHANGE);
    expect(setLocalDefinitionKey).toHaveBeenCalledWith(DEFINITION_KEY);
    expect(setHasDirtyEdits).toHaveBeenCalledWith(false);
  });

  it('keeps reparse reaching transport while a document change is pending', async () => {
    const { result, setDocumentChange, setLocalDefinitionKey } = renderSequence({
      isDocumentChangePending: true,
    });

    let outcome: UpsertAssignmentDefinitionResponse | undefined;
    await act(async () => {
      outcome = await result.current.runWizardMutation({
        actionType: 'reparse',
        request: buildReparseRequest(CANONICAL_DEFINITION),
        definitionKey: DEFINITION_KEY,
      });
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      definitionKey: DEFINITION_KEY,
      forceReparse: true,
    });
    expect(outcome).toBe(CANONICAL_DEFINITION);
    expect(setDocumentChange).toHaveBeenCalledWith(RESOLVED_DOCUMENT_CHANGE);
    // Reparse targets an existing key, so it never adopts a new local one.
    expect(setLocalDefinitionKey).not.toHaveBeenCalled();
  });

  it('rejects a save while another mutation is still in flight', async () => {
    let resolveInFlight!: (value: AssignmentDefinition) => void;
    const pendingResponse = new Promise<AssignmentDefinition>((resolve) => {
      resolveInFlight = resolve;
    });
    // Only the first call parks. Any later call falls through to the default
    // response so a guard regression fails on the call-count assertion below
    // instead of leaving the first promise unsettled.
    upsertMock.mockImplementationOnce(() => pendingResponse);

    const { result } = renderSequence({ isDocumentChangePending: false });

    let inFlight!: Promise<UpsertAssignmentDefinitionResponse | undefined>;
    act(() => {
      inFlight = result.current.runWizardMutation({
        actionType: 'reparse',
        request: buildReparseRequest(CANONICAL_DEFINITION),
        definitionKey: DEFINITION_KEY,
      });
    });

    // The busy flag only lands once the first mutation has been dispatched.
    await act(async () => {
      await Promise.resolve();
    });

    let overlappingSave: UpsertAssignmentDefinitionResponse | undefined = CANONICAL_DEFINITION;
    await act(async () => {
      overlappingSave = await result.current.runWizardMutation({
        actionType: 'save',
        request: buildSettledSaveRequest(),
        definitionKey: DEFINITION_KEY,
      });
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(overlappingSave).toBeUndefined();

    await act(async () => {
      resolveInFlight(CANONICAL_DEFINITION);
      await inFlight;
    });
  });
});
