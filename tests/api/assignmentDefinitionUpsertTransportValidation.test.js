import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const TRANSPORT_PATH = '../../src/backend/z_Api/assignmentDefinitionTransport.js';
const UPSERT_VALIDATION_PATH =
  '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js';
const PARTIAL_ROW_VALIDATION_PATH =
  '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js';

function clearTransportCaches() {
  for (const modulePath of [TRANSPORT_PATH, UPSERT_VALIDATION_PATH, PARTIAL_ROW_VALIDATION_PATH]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }
}

function loadUpsertTransport() {
  clearTransportCaches();
  return require(TRANSPORT_PATH);
}

function buildValidIdPayload(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    ...overrides,
  };
}

function buildValidWizardPayload(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-001/edit',
    templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-001/edit',
    ...overrides,
  };
}

function loadUpsertValidation() {
  clearTransportCaches();
  return require(UPSERT_VALIDATION_PATH);
}

function buildFullDefinition(overrides = {}) {
  return {
    definitionKey: 'definition-001',
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: 1,
    tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

function buildValidPartialRow(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: 1,
    definitionKey: 'algebra-baseline',
    tasks: [],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

function installUpsertControllerStub() {
  const upsertDefinition = vi.fn();
  const getFullAssignmentDefinition = vi.fn((definition) => definition);
  const AssignmentDefinitionController = vi.fn(function StubController() {
    this.upsertDefinition = upsertDefinition;
    this.getFullAssignmentDefinition = getFullAssignmentDefinition;
  });
  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;
  return { upsertDefinition, getFullAssignmentDefinition };
}

function installPartialsControllerStub(rows) {
  const getAllPartialDefinitions = vi.fn(() => rows);
  const AssignmentDefinitionController = vi.fn(function StubController() {
    this.getAllPartialDefinitions = getAllPartialDefinitions;
  });
  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;
  return { getAllPartialDefinitions };
}

function readSourceRelative(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf8');
}

describe('upsert recovery field-shape single validation', () => {
  let originalController;

  beforeEach(() => {
    originalController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearTransportCaches();
    if (originalController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalController;
    }
    vi.restoreAllMocks();
  });

  it('validates recovery field shapes exactly once per upsert request at the transport entry', () => {
    const source = readSourceRelative(
      '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js'
    );
    const occurrences = source.split('validateRecoveryFieldShapes_(').length - 1;
    // One function definition plus exactly one call site at the transport entry.
    expect(occurrences).toBe(2);
  });

  it('rejects a non-boolean forceReparse on the wizard path without reaching the controller', () => {
    const { upsertDefinition } = installUpsertControllerStub();
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    expect(() =>
      upsertAssignmentDefinition_(buildValidWizardPayload({ forceReparse: 'yes' }))
    ).toThrow(ApiValidationError);
    expect(upsertDefinition).not.toHaveBeenCalled();
  });
});

describe('shared upsert identifier validation contracts', () => {
  it.each([
    [null, 'primaryTopicKey must be a string.'],
    ['   ', 'primaryTopicKey must be a non-empty string.'],
    [' topic-algebra', 'primaryTopicKey must already be trimmed.'],
    ['topic/algebra', 'primaryTopicKey contains unsafe characters.'],
  ])('pins primaryTopicKey error for %p', (value, message) => {
    const { validateUpsertParameters_ } = loadUpsertValidation();

    expect(() =>
      validateUpsertParameters_(buildValidIdPayload({ primaryTopicKey: value }))
    ).toThrow(expect.objectContaining({ message, fieldName: 'primaryTopicKey' }));
  });

  it.each([
    [1, 'definitionKey must be a string when provided.'],
    ['   ', 'definitionKey must be a non-empty string.'],
    [' definition-001', 'definitionKey must already be trimmed.'],
    ['definition/001', 'definitionKey contains unsafe characters.'],
  ])('pins optional definitionKey error for %p', (value, message) => {
    const { validateUpsertParameters_ } = loadUpsertValidation();

    expect(() => validateUpsertParameters_(buildValidIdPayload({ definitionKey: value }))).toThrow(
      expect.objectContaining({ message, fieldName: 'definitionKey' })
    );
  });
});

describe('upsert raw document identifier safety', () => {
  let originalController;

  beforeEach(() => {
    originalController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearTransportCaches();
    if (originalController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalController;
    }
    vi.restoreAllMocks();
  });

  it.each([
    { field: 'referenceDocumentId', value: 'doc..id' },
    { field: 'referenceDocumentId', value: 'doc/id' },
    { field: 'referenceDocumentId', value: 'doc\\id' },
    { field: 'referenceDocumentId', value: ' ref-doc-001' },
    { field: 'referenceDocumentId', value: 'ref-doc-001 ' },
    { field: 'referenceDocumentId', value: 'ref-doc-001\u0007' },
    { field: 'templateDocumentId', value: 'doc..id' },
    { field: 'templateDocumentId', value: 'doc/id' },
    { field: 'templateDocumentId', value: 'doc\\id' },
    { field: 'templateDocumentId', value: 'tpl-doc-001 ' },
    { field: 'templateDocumentId', value: '..' },
  ])('rejects unsafe raw $field value before controller access: $value', ({ field, value }) => {
    const { upsertDefinition } = installUpsertControllerStub();
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    expect(() => upsertAssignmentDefinition_(buildValidIdPayload({ [field]: value }))).toThrow(
      ApiValidationError
    );
    expect(upsertDefinition).not.toHaveBeenCalled();
  });
});

describe('upsert extracted document identifier safety', () => {
  let originalController;

  beforeEach(() => {
    originalController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearTransportCaches();
    if (originalController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalController;
    }
    vi.restoreAllMocks();
  });

  it.each([
    {
      caseName: 'dot-dot reference segment',
      referenceDocumentUrl: 'https://docs.google.com/presentation/d/../edit',
    },
    {
      caseName: 'embedded dot-dot reference segment',
      referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref..doc/edit',
    },
    {
      caseName: 'dot-dot template segment',
      templateDocumentUrl: 'https://docs.google.com/presentation/d/../edit',
    },
  ])('rejects unsafe URL-extracted identifiers before Drive access: $caseName', (urls) => {
    const { upsertDefinition } = installUpsertControllerStub();
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    const { caseName: _caseName, ...urlOverrides } = urls;
    expect(() => upsertAssignmentDefinition_(buildValidWizardPayload(urlOverrides))).toThrow(
      ApiValidationError
    );
    expect(upsertDefinition).not.toHaveBeenCalled();
  });
});

describe('upsert baseline timestamp strictness', () => {
  let originalController;

  beforeEach(() => {
    originalController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearTransportCaches();
    if (originalController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalController;
    }
    vi.restoreAllMocks();
  });

  it.each([
    { caseName: 'plain text', value: 'not-a-timestamp' },
    { caseName: 'date only', value: '2026-01-05' },
    { caseName: 'missing timezone', value: '2026-01-05T10:00:00.000' },
    { caseName: 'missing milliseconds', value: '2026-01-05T10:00:00Z' },
    { caseName: 'impossible date', value: '2026-13-40T99:99:99.000Z' },
    { caseName: 'offset beyond range', value: '2026-01-05T10:00:00.000+24:00' },
  ])('rejects malformed non-null baseline before controller access: $caseName', ({ value }) => {
    const { upsertDefinition } = installUpsertControllerStub();
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    expect(() =>
      upsertAssignmentDefinition_(buildValidIdPayload({ expectedDefinitionUpdatedAt: value }))
    ).toThrow(ApiValidationError);
    expect(upsertDefinition).not.toHaveBeenCalled();
  });

  it('allows explicit null baseline for create-time requests', () => {
    const { upsertDefinition } = installUpsertControllerStub();
    upsertDefinition.mockReturnValue(buildFullDefinition());
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    expect(() =>
      upsertAssignmentDefinition_(buildValidIdPayload({ expectedDefinitionUpdatedAt: null }))
    ).not.toThrow();
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
  });

  it('allows omitted baseline to retain ordinary upsert behaviour', () => {
    const { upsertDefinition } = installUpsertControllerStub();
    upsertDefinition.mockReturnValue(buildFullDefinition());
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    const payload = buildValidIdPayload();
    delete payload.expectedDefinitionUpdatedAt;
    expect(() => upsertAssignmentDefinition_(payload)).not.toThrow();
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
  });

  it.each([
    { caseName: 'UTC suffix', value: '2026-01-06T12:30:00.000Z' },
    { caseName: 'positive offset', value: '2026-01-06T12:30:00.000+01:00' },
  ])('accepts strict ISO baseline with timezone: $caseName', ({ value }) => {
    const { upsertDefinition } = installUpsertControllerStub();
    upsertDefinition.mockReturnValue(buildFullDefinition());
    const { upsertAssignmentDefinition_ } = loadUpsertTransport();
    expect(() =>
      upsertAssignmentDefinition_(buildValidIdPayload({ expectedDefinitionUpdatedAt: value }))
    ).not.toThrow();
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
  });
});

describe('partial-row transport enforcement', () => {
  let originalController;

  beforeEach(() => {
    originalController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearTransportCaches();
    if (originalController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalController;
    }
    vi.restoreAllMocks();
  });

  it('enforces validatePartialRow_ at the partials transport boundary', () => {
    const source = readSourceRelative('../../src/backend/z_Api/assignmentDefinitionTransport.js');
    expect(source).toContain('validatePartialRow_(');
  });

  it.each([
    {
      caseName: 'missing definitionKey',
      mutate: (row) => {
        delete row.definitionKey;
      },
    },
    {
      caseName: 'blank definitionKey',
      mutate: (row) => {
        row.definitionKey = '   ';
      },
    },
    {
      caseName: 'untrimmed definitionKey',
      mutate: (row) => {
        row.definitionKey = ' algebra-baseline';
      },
    },
    {
      caseName: 'null yearGroupLabel',
      mutate: (row) => {
        row.yearGroupLabel = null;
      },
    },
    {
      caseName: 'malformed createdAt',
      mutate: (row) => {
        row.createdAt = 'not-a-date';
      },
    },
    {
      caseName: 'tasks object instead of array',
      mutate: (row) => {
        row.tasks = { taskId: 'task-1' };
      },
    },
  ])('rejects invalid partial rows at the transport response: $caseName', ({ mutate }) => {
    const row = buildValidPartialRow();
    mutate(row);
    installPartialsControllerStub([row]);
    const { getAssignmentDefinitionPartials_ } = loadUpsertTransport();
    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });

  it('returns valid partial rows unchanged', () => {
    installPartialsControllerStub([buildValidPartialRow()]);
    const { getAssignmentDefinitionPartials_ } = loadUpsertTransport();
    expect(getAssignmentDefinitionPartials_()).toHaveLength(1);
  });
});
