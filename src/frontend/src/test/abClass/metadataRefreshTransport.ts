import { vi } from 'vitest';
import { ApiRequestSchema } from '@/services/apiService';
import { UpdateABClassRequestSchema } from '@/services/abClass/abClassMutations.zod';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { createGoogleScriptRunApiHandlerMock } from '../googleScriptRunHarness';

/** Installs an in-memory backend stub behind the real callApi and GAS harness.
 * @param {ClassFull | null} initial - Authoritative fresh document (never a query cache).
 * @returns {object} Dispatch trace, stored document, response override and held-call controls.
 */
export function installMetadataRefreshTransport(initial: ClassFull | null) {
  let stored = structuredClone(initial);
  const events: string[] = [];
  const requests: { method: string; params?: unknown }[] = [];
  const holds = new Map<string, () => void>();
  const blocked = new Set<string>();
  const overrides = new Map<string, unknown>();
  const failures = new Set<string>();
  const afterWrite = vi.fn<(document: ClassFull) => void>();
  const dispatched = vi.fn((request: unknown) => {
    const parsed = ApiRequestSchema.parse(request);
    events.push(parsed.method);
    requests.push(parsed);
    return parsed;
  });
  const responseData = (parsed: ReturnType<typeof ApiRequestSchema.parse>): unknown => {
    if (overrides.has(parsed.method)) return overrides.get(parsed.method);
    if (parsed.method === 'getABClass') return structuredClone(stored);
    if (parsed.method !== 'updateABClass')
      throw new Error(`Unexpected metadata transport method: ${parsed.method}`);
    if (!stored) throw new Error('Cannot update an absent class');
    const params = UpdateABClassRequestSchema.parse(parsed.params);
    stored = { ...stored, metadata: structuredClone(params.metadata!) };
    afterWrite(stored);
    return ClassPartialSchema.parse(stored);
  };
  const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
    const parsed = dispatched(request);
    const respond = () => {
      if (failures.has(parsed.method)) {
        callbacks.successHandler?.({
          ok: false,
          requestId: 'metadata-failure',
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Metadata persistence failed',
            isRetriable: false,
          },
        });
        return;
      }
      const data = responseData(parsed);
      callbacks.successHandler?.({ ok: true, requestId: `metadata-${requests.length}`, data });
    };
    if (blocked.has(parsed.method)) holds.set(parsed.method, respond);
    else respond();
  });
  vi.stubGlobal('google', { script: { run: runner } });
  return {
    events,
    requests,
    dispatched,
    blocked,
    overrides,
    failures,
    afterWrite,
    releaseAll: () => {
      for (const respond of holds.values()) respond();
      holds.clear();
    },
    readStored: () => structuredClone(stored),
    replaceStored: (value: ClassFull | null) => {
      stored = structuredClone(value);
    },
    release: (method: string) => {
      const respond = holds.get(method);
      if (!respond) throw new Error(`No held ${method} request`);
      holds.delete(method);
      respond();
    },
  };
}
