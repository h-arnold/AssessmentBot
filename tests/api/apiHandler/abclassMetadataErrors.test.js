import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { saveGlobals, restoreGlobals } from '#test-helpers/globalMockManager.js';
import {
  setupRealAbclassDispatcher,
  teardownRealAbclassDispatcher,
} from './abclassMetadataTestContext.js';
import {
  createDispatcherAuthEnvironment,
  installLockServiceMock,
  readPersistedUserRequestStore,
  setupDispatcherAuthTest,
  teardownDispatcherAuthTest,
  expectBoundaryFailureConsoleErrorLog,
} from './shared.js';

const canonical = loadBackendModelInputs('small');
const source = Object.values(canonical.classesById).find(
  (row) => row.metadata !== null && row.cohortKey && row.yearGroupKey
);
const registryRows = [
  { ...canonical.classPartials.find((row) => row.classId === source.classId), _id: 'partial-row' },
];
const { ABClass } = require('#backend/Models/ABClass.js');
const globalsToRestore = [
  'Utilities',
  'LockService',
  'PropertiesService',
  'ABClassController',
  'ABClass',
  'Teacher',
  'DbManager',
  'ClassroomApiClient',
  'getABClass_',
  'upsertABClass_',
  'updateABClass_',
  'deleteABClass_',
];

describe('ABClass metadata dispatcher error contracts', () => {
  let context;
  afterEach(() => {
    if (context?.realContext) teardownRealAbclassDispatcher(vi, context.realContext);
    if (context?.authContext) teardownDispatcherAuthTest(vi, context.authContext);
    if (context?.saved) restoreGlobals(context.saved);
    context = undefined;
  });

  it.each([
    ['upsertABClass', 'invalid metric'],
    ['updateABClass', 'invalid metric'],
    ['upsertABClass', 'own undefined'],
    ['updateABClass', 'own undefined'],
  ])(
    '%s maps %s metadata to a private request error without side effects',
    (method, invalidKind) => {
      context = {
        realContext: setupRealAbclassDispatcher(vi, canonical, {
          classId: source.classId,
          partialRows: registryRows,
        }),
      };
      const initialFull = context.realContext.full.rows();
      const initialPartial = context.realContext.partial.rows();
      const domainValidation = vi.spyOn(globalThis.ABClassMetadata, 'validateMetadata');
      const invalid =
        invalidKind === 'own undefined' ? undefined : structuredClone(source.metadata);
      if (invalid) invalid.classAverages.overall = 8;
      const metadataProperty = { metadata: invalid };
      const params =
        method === 'upsertABClass'
          ? {
              classId: source.classId,
              cohortKey: source.cohortKey,
              yearGroupKey: source.yearGroupKey,
              courseLength: source.courseLength,
              ...metadataProperty,
            }
          : { classId: source.classId, active: false, ...metadataProperty };
      const response = context.realContext.api.apiHandler({ method, params });
      expect
        .soft(
          response,
          JSON.stringify(context.realContext.seams.errorSpy.mock.calls.map((call) => call[2]))
        )
        .toMatchObject({
          ok: false,
          error: {
            code: 'INVALID_REQUEST',
            isRetriable: false,
            message: expect.stringContaining(
              invalidKind === 'own undefined' ? 'metadata' : 'metadata.classAverages.overall'
            ),
          },
        });
      expect.soft(Object.keys(response.error).sort()).toEqual(['code', 'isRetriable', 'message']);
      expect.soft(JSON.stringify(response)).not.toContain('stack');
      expect.soft(context.realContext.full.rows()).toEqual(initialFull);
      expect.soft(context.realContext.partial.rows()).toEqual(initialPartial);
      expect.soft(context.realContext.manager.getCollection).not.toHaveBeenCalled();
      const storeCalls = (store) => ({
        findOne: store.findOne.mock.calls.length,
        find: store.find.mock.calls.length,
        insertOne: store.insertOne.mock.calls.length,
        replaceOne: store.replaceOne.mock.calls.length,
        updateOne: store.updateOne.mock.calls.length,
        save: store.save.mock.calls.length,
      });
      expect
        .soft({
          collectionAccess: context.realContext.manager.getCollection.mock.calls.length,
          roster: {
            fetchCourse: context.realContext.classroom.fetchCourse.mock.calls.length,
            fetchTeachers: context.realContext.classroom.fetchTeachers.mock.calls.length,
            fetchAllStudents: context.realContext.classroom.fetchAllStudents.mock.calls.length,
          },
          fullStore: storeCalls(context.realContext.full),
          partialStore: storeCalls(context.realContext.partial),
        })
        .toEqual({
          collectionAccess: 0,
          roster: { fetchCourse: 0, fetchTeachers: 0, fetchAllStudents: 0 },
          fullStore: {
            findOne: 0,
            find: 0,
            insertOne: 0,
            replaceOne: 0,
            updateOne: 0,
            save: 0,
          },
          partialStore: {
            findOne: 0,
            find: 0,
            insertOne: 0,
            replaceOne: 0,
            updateOne: 0,
            save: 0,
          },
        });
      expect.soft(domainValidation).toHaveBeenCalledWith(invalid, 'metadata');
    }
  );

  it.each([
    ['upsertABClass', 'null'],
    ['upsertABClass', 'replacement'],
    ['updateABClass', 'null'],
    ['updateABClass', 'replacement'],
  ])('%s treats corrupt stored metadata as internal for %s', (method, replacementKind) => {
    const corrupted = structuredClone(source);
    corrupted.metadata.classAverages.overall = 8;
    context = {
      realContext: setupRealAbclassDispatcher(
        vi,
        { ...canonical, classesById: { ...canonical.classesById, [source.classId]: corrupted } },
        { classId: source.classId, partialRows: registryRows }
      ),
    };
    const metadata = replacementKind === 'null' ? null : structuredClone(source.metadata);
    const params =
      method === 'upsertABClass'
        ? {
            classId: source.classId,
            cohortKey: source.cohortKey,
            yearGroupKey: source.yearGroupKey,
            courseLength: source.courseLength,
            metadata,
          }
        : { classId: source.classId, metadata };
    const response = context.realContext.api.apiHandler({ method, params });
    expect.soft(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal API error.', isRetriable: false },
    });
    expect.soft(JSON.stringify(response)).not.toContain('metadata.classAverages.overall');
    expect(context.realContext.full.replaceOne).not.toHaveBeenCalled();
    expect(context.realContext.full.updateOne).not.toHaveBeenCalled();
    expect(context.realContext.partial.replaceOne).not.toHaveBeenCalled();
  });

  it('keeps corrupt stored full metadata internal on the full-read path', () => {
    const corrupted = structuredClone(source);
    corrupted.metadata.classAverages.overall = 8;
    context = {
      realContext: setupRealAbclassDispatcher(
        vi,
        { ...canonical, classesById: { ...canonical.classesById, [source.classId]: corrupted } },
        { classId: source.classId, partialRows: registryRows }
      ),
    };
    const response = context.realContext.api.apiHandler({
      method: 'getABClass',
      params: { classId: source.classId, partialRows: registryRows },
    });
    expect.soft(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal API error.' },
    });
    expect(context.realContext.full.findOne).toHaveBeenCalledTimes(1);
    expect(context.realContext.full.replaceOne).not.toHaveBeenCalled();
    expect(context.realContext.partial.replaceOne).not.toHaveBeenCalled();
  });

  it('keeps mutable model corruption during real restoration and projection internal', () => {
    context = {
      realContext: setupRealAbclassDispatcher(vi, canonical, {
        classId: source.classId,
        partialRows: registryRows,
      }),
    };
    const restore = ABClass.fromJSON;
    const restoreAndCorrupt = vi.spyOn(ABClass, 'fromJSON').mockImplementation((...args) => {
      const model = restore(...args);
      model.metadata.classAverages.overall = 8;
      return model;
    });
    const response = context.realContext.api.apiHandler({
      method: 'getABClass',
      params: { classId: source.classId, partialRows: registryRows },
    });
    expect(restoreAndCorrupt).toHaveBeenCalledTimes(1);
    expect.soft(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal API error.' },
    });
    expect(context.realContext.full.replaceOne).not.toHaveBeenCalled();
    expect(context.realContext.partial.replaceOne).not.toHaveBeenCalled();
  });

  it('rejects corrupt registry rows without falling back to full reads or writes', () => {
    const corrupted = structuredClone(
      canonical.classPartials.find((row) => row.classId === source.classId)
    );
    corrupted.metadata.classAverages.overall = 8;
    context = {
      realContext: setupRealAbclassDispatcher(vi, canonical, {
        classId: source.classId,
        partialRows: [{ ...corrupted, _id: 'corrupt-partial' }],
      }),
    };
    const response = context.realContext.api.apiHandler({ method: 'getABClassPartials' });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal API error.' },
    });
    expect(context.realContext.full.findOne).not.toHaveBeenCalled();
    expect(context.realContext.partial.replaceOne).not.toHaveBeenCalled();
    expect(context.realContext.partial.updateOne).not.toHaveBeenCalled();
  });

  it('denies an unauthorised caller before admission or controller/collection access', () => {
    context = { saved: saveGlobals(globalsToRestore), authContext: setupDispatcherAuthTest(vi) };
    context.authContext.authEnvironment = createDispatcherAuthEnvironment(vi);
    globalThis.Session._setActiveUserEmail('outsider@school.edu');
    const controller = vi.fn();
    globalThis.ABClassController = controller;
    const collectionAccess = vi.fn();
    globalThis.DbManager = { getInstance: () => ({ getCollection: collectionAccess }) };
    const lock = installLockServiceMock(vi);
    const { apiHandler } = require('#backend/z_Api/z_apiHandler.js');
    const response = apiHandler({ method: 'getABClassPartials' });
    expect(response).toMatchObject({ ok: false, error: { code: 'FORBIDDEN', isRetriable: false } });
    expect(controller).not.toHaveBeenCalled();
    expect(collectionAccess).not.toHaveBeenCalled();
    expect(readPersistedUserRequestStore()).toEqual({});
    expect(lock.mockLock.tryLock).not.toHaveBeenCalled();
  });

  it('tracks an allowlisted request ID through started and success completion', () => {
    context = {
      realContext: setupRealAbclassDispatcher(vi, canonical, {
        classId: source.classId,
        partialRows: registryRows,
      }),
      saved: saveGlobals(['Utilities', 'PropertiesService']),
    };
    globalThis.Utilities = {
      ...globalThis.Utilities,
      getUuid: vi.fn(() => 'metadata-accepted-id'),
    };
    const requestStatuses = [];
    const properties = globalThis.PropertiesService;
    globalThis.PropertiesService = {
      ...properties,
      getUserProperties() {
        const store = properties.getUserProperties();
        return {
          ...store,
          setProperty(key, value) {
            if (key.toLowerCase().includes('request')) {
              const entry = Object.values(JSON.parse(value)).find(
                (record) => record.requestId === 'metadata-accepted-id'
              );
              if (entry) requestStatuses.push(entry.status);
            }
            return store.setProperty(key, value);
          },
        };
      },
    };
    const response = context.realContext.api.apiHandler({ method: 'getABClassPartials' });
    expect(response.requestId).toBe('metadata-accepted-id');
    expect(readPersistedUserRequestStore()['metadata-accepted-id']).toMatchObject({
      method: 'getABClassPartials',
      status: 'success',
    });
    expect(requestStatuses).toEqual(['started', 'success']);
  });

  it('records raw downstream and boundary diagnostics before error completion while keeping the envelope private', () => {
    context = {
      realContext: setupRealAbclassDispatcher(vi, canonical, {
        classId: source.classId,
        partialRows: registryRows,
      }),
    };
    const failure = new Error('database failure with private details');
    context.realContext.full.findOne.mockImplementation(() => {
      throw failure;
    });
    const logger = require('#backend/Utils/ABLogger.js');
    logger.resetForTests?.();
    globalThis.ABLogger = logger;
    const events = [];
    const originalProperties = globalThis.PropertiesService;
    globalThis.PropertiesService = {
      ...originalProperties,
      getUserProperties() {
        const store = originalProperties.getUserProperties();
        return {
          ...store,
          setProperty(key, value) {
            if (key.toLowerCase().includes('request')) {
              const entry = Object.values(JSON.parse(value)).find(
                (item) => item.status === 'error'
              );
              if (entry) events.push('completion-persisted');
            }
            return store.setProperty(key, value);
          },
        };
      },
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (args[0] === 'API request failed.') events.push('boundary-logged');
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = context.realContext.api.apiHandler({
      method: 'getABClass',
      params: { classId: source.classId, partialRows: registryRows },
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal API error.' },
    });
    expect(JSON.stringify(response)).not.toContain(failure.message);
    const boundary = expectBoundaryFailureConsoleErrorLog(consoleErrorSpy, {
      response,
      methodName: 'getABClass',
      thrownError: failure,
    });
    expect(boundary).toBeDefined();
    expect(events.indexOf('boundary-logged')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('completion-persisted')).toBeGreaterThan(
      events.indexOf('boundary-logged')
    );
    expect(
      consoleErrorSpy.mock.calls.some(
        (args) => args[0] === 'getABClass failed' && args[1]?.err?.message === failure.message
      )
    ).toBe(true);
    expect(readPersistedUserRequestStore()[response.requestId]).toMatchObject({
      status: 'error',
      method: 'getABClass',
    });
    expect(logger.getInstance()).toBeDefined();
  });
});
