import { stat, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { argv } from 'node:process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

// The plugin runs under opencode's bundled Bun, which provides `Bun.file`. This regression
// harness runs under plain Node (no Bun installed in CI/test shells), so we shim the single
// Bun API the plugin touches. This is the only place a global shim is acceptable.
interface BunFileShim {
  stat: () => Promise<{ size: number }>;
  text: () => Promise<string>;
}

const bunFileShim = (filePath: string): BunFileShim => ({
  async stat(): Promise<{ size: number }> {
    const fileStat = await stat(filePath);
    return { size: fileStat.size };
  },
  text: async (): Promise<string> => await readFile(filePath, 'utf8'),
});

// Worktree root: three levels up from this file (.opencode/plugins/tests/ -> repo root).
const WORKTREE =
  process.env.OPENCODE_WORKTREE ?? path.resolve(import.meta.dirname, '..', '..', '..');

interface ToolDefinitionHookOutput {
  parameters: unknown;
  description?: string;
}

interface ExecuteBeforeHookOutput {
  args: { prompt?: string; files?: unknown };
}

type HookMap = {
  'tool.definition': (input: { toolID: string }, output: ToolDefinitionHookOutput) => Promise<void>;
  'tool.execute.before': (
    input: { tool: string },
    output: ExecuteBeforeHookOutput
  ) => Promise<void>;
};

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  jsonSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Shared `lines.txt` fixture, relative to the worktree root.
const FIXTURE_LINES_PATH = '.opencode/plugins/tests/fixtures/lines.txt';

// Line counts asserted against the shared `lines.txt` fixture.
const FIXTURE_TOTAL_LINES = 10;
const FIXTURE_OFFSET_ONLY_LINES = 6;
const FIXTURE_LIMIT_ONLY_LINES = 3;
const FIXTURE_OFFSET_AND_LIMIT_LINES = 4;
const FIXTURE_REMAINING_LINES = 3;
const FIXTURE_DUPLICATE_RANGES_LINES = 4;

const failedAssertions: string[] = [];

/**
 * Record the outcome of a single harness assertion.
 *
 * @param {string} name - Human-readable description of the assertion being checked.
 * @param {boolean} condition - Whether the assertion passed.
 */
function assert(name: string, condition: boolean): void {
  if (!condition) {
    failedAssertions.push(name);
  }
}

/**
 * Load the task-files plugin and return its registered hooks.
 *
 * @returns {Promise<HookMap>} The plugin's `tool.definition` and `tool.execute.before` hooks.
 */
async function loadPlugin(): Promise<HookMap> {
  // Install the Bun.file shim before importing the plugin module; the plugin only
  // touches `Bun.file` when its hooks execute, which always happens after this point.
  Object.assign(globalThis, { Bun: { file: bunFileShim } });
  const pluginModule = (await import('../task-files.ts')) as unknown as {
    default: (input: { worktree: string; directory: string }) => Promise<HookMap>;
  };
  return pluginModule.default({ worktree: WORKTREE, directory: WORKTREE });
}

/**
 * Remove a temporary fixture file, ignoring failure so cleanup never masks the assertions.
 *
 * @param {string} filePath - Absolute path of the temporary file to remove.
 */
async function removeIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Best-effort cleanup; the file may already be gone.
  }
}

/**
 * Scenario 1: tool.definition must advertise `files` in BOTH the model-facing parameters
 * and the parse-time jsonSchema (the task tool ships an explicit jsonSchema, so patching
 * only parameters would be silently dropped at parse time).
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertDefinitionHooks(hooks: HookMap): Promise<void> {
  const baseTool: ToolDefinition = {
    name: 'task',
    description: 'run a task',
    parameters: {
      type: 'object',
      properties: { description: {}, prompt: {}, subagent_type: {} },
      required: ['prompt'],
    },
    jsonSchema: {
      type: 'object',
      properties: { description: {}, prompt: {}, subagent_type: {} },
      required: ['prompt'],
    },
  };
  await hooks['tool.definition']({ toolID: 'task' }, baseTool);
  assert('definition: parameters.files present', 'files' in baseTool.parameters.properties);
  assert('definition: jsonSchema.files present', 'files' in baseTool.jsonSchema.properties);
  assert(
    'definition: existing params preserved',
    'prompt' in baseTool.parameters.properties && 'subagent_type' in baseTool.parameters.properties
  );
  assert(
    'definition: parameters.required includes files',
    baseTool.parameters.required.includes('files')
  );
  assert(
    'definition: jsonSchema.required includes files',
    baseTool.jsonSchema.required.includes('files')
  );
}

/**
 * Scenario 2: tool.execute.before constructs the injected prompt deterministically.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertOrderedInjection(hooks: HookMap): Promise<void> {
  const ordered = {
    args: {
      prompt: 'ACTUAL_INSTRUCTION_TEXT',
      files: [
        '.opencode/plugins/tests/fixtures/beta.txt',
        '.opencode/plugins/tests/fixtures/alpha.txt',
        '.opencode/plugins/tests/fixtures/missing.txt',
      ],
    },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, ordered);
  const prompt = ordered.args.prompt ?? '';
  assert('execute: files arg removed from args', !('files' in ordered.args));
  assert('execute: contains ALPHA marker', prompt.includes('ALPHA_MARKER_8821'));
  assert('execute: contains BETA marker', prompt.includes('BETA_MARKER_4497'));
  assert('execute: contains Skipped note', prompt.includes('Skipped'));
  assert(
    'execute: alphabetical order (alpha before beta)',
    prompt.indexOf('ALPHA_MARKER_8821') < prompt.indexOf('BETA_MARKER_4497')
  );
  assert('execute: original instruction preserved', prompt.includes('ACTUAL_INSTRUCTION_TEXT'));
  assert('execute: separator present', prompt.includes('\n---\n'));
}

/**
 * Scenario 3: a path escaping the worktree is skipped, never read or injected.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertEscapedPathSkipped(hooks: HookMap): Promise<void> {
  const escaped = { args: { prompt: 'X', files: ['../etc/passwd'] } };
  await hooks['tool.execute.before']({ tool: 'task' }, escaped);
  const escapedPrompt = escaped.args.prompt ?? '';
  assert('security: escape path not injected as content', !escapedPrompt.includes('root:'));
  assert(
    'security: escape produces out-of-worktree skip note',
    escapedPrompt.includes('Skipped') && escapedPrompt.includes('outside the project worktree')
  );
}

/**
 * Scenario 4: no files leaves the prompt untouched.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertNoFilesUntouched(hooks: HookMap): Promise<void> {
  const none = { args: { prompt: 'PLAIN', files: [] } };
  await hooks['tool.execute.before']({ tool: 'task' }, none);
  assert('no-files: prompt unchanged', none.args.prompt === 'PLAIN');
  assert('no-files: files arg removed', !('files' in none.args));
}

/**
 * Scenario 4b: a missing or non-array `files` value is REJECTED (the parameter is
 * mandatory). This protects against silent file-context loss — the call must not proceed.
 * Internal programmatic task calls (via `registry.named().task`) never reach this hook, so
 * they are unaffected by the rejection.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertMissingFilesRejected(hooks: HookMap): Promise<void> {
  const absent = { args: { prompt: 'ABSENT' } };
  let absentThrew = false;
  try {
    await hooks['tool.execute.before']({ tool: 'task' }, absent);
  } catch {
    absentThrew = true;
  }
  assert('no-files-key: missing files rejects the call', absentThrew);

  const undefinedFiles = { args: { prompt: 'UNDEFINED', files: undefined } };
  let undefinedThrew = false;
  try {
    await hooks['tool.execute.before']({ tool: 'task' }, undefinedFiles);
  } catch {
    undefinedThrew = true;
  }
  assert('no-files-key: undefined files rejects the call', undefinedThrew);

  const wrongType = { args: { prompt: 'WRONG', files: 'src/foo.ts' } };
  let wrongThrew = false;
  try {
    await hooks['tool.execute.before']({ tool: 'task' }, wrongType);
  } catch {
    wrongThrew = true;
  }
  assert('no-files-key: non-array files rejects the call', wrongThrew);
}

/**
 * Scenario 5: an oversized file (above the 256 KiB cap) is skipped with a note, not injected.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertOversizedSkipped(hooks: HookMap): Promise<void> {
  const MAX_FILE_BYTES = 262_144;
  const oversizedRelativePath = '.opencode/plugins/tests/fixtures/oversized.tmp';
  const oversizedAbsolutePath = path.resolve(WORKTREE, oversizedRelativePath);
  await writeFile(oversizedAbsolutePath, Buffer.alloc(MAX_FILE_BYTES + 1, 'A'.charCodeAt(0)));
  const big = { args: { prompt: 'Y', files: [oversizedRelativePath] } };
  try {
    await hooks['tool.execute.before']({ tool: 'task' }, big);
  } finally {
    await removeIfExists(oversizedAbsolutePath);
  }
  const bigPrompt = big.args.prompt ?? '';
  assert('oversized: not injected as content', !bigPrompt.includes('AAAA'));
  assert(
    'oversized: skip note present',
    bigPrompt.includes('Skipped') && bigPrompt.includes('byte limit')
  );
}

/**
 * Scenario 6: string paths still work and get line-numbered output.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertStringPathBackCompat(hooks: HookMap): Promise<void> {
  const bc = { args: { prompt: 'S', files: [FIXTURE_LINES_PATH] } };
  await hooks['tool.execute.before']({ tool: 'task' }, bc);
  const bcPrompt = bc.args.prompt ?? '';
  assert('backcompat: files arg removed', !('files' in bc.args));
  assert('backcompat: first line numbered', bcPrompt.includes('1: first line'));
  assert('backcompat: tenth line numbered', bcPrompt.includes('10: tenth line'));
  assert(
    'backcompat: all 10 lines present',
    (bcPrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_TOTAL_LINES
  );
  assert('backcompat: original instruction preserved', bcPrompt.includes('S'));
}

/**
 * Scenario 7: object format with offset only (start at line 5).
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertOffsetOnly(hooks: HookMap): Promise<void> {
  const offsetOnly = {
    args: { prompt: 'T', files: [{ path: FIXTURE_LINES_PATH, offset: 5 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, offsetOnly);
  const offPrompt = offsetOnly.args.prompt ?? '';
  assert('offset-only: starts at line 5', offPrompt.includes('5: fifth line'));
  assert('offset-only: ends at line 10', offPrompt.includes('10: tenth line'));
  assert('offset-only: does not include line 4', !offPrompt.includes('4: fourth line'));
  assert(
    'offset-only: 6 lines injected',
    (offPrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_OFFSET_ONLY_LINES
  );
}

/**
 * Scenario 8: object format with limit only (first 3 lines).
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertLimitOnly(hooks: HookMap): Promise<void> {
  const limitOnly = {
    args: { prompt: 'U', files: [{ path: FIXTURE_LINES_PATH, limit: 3 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, limitOnly);
  const limPrompt = limitOnly.args.prompt ?? '';
  assert('limit-only: line 1 present', limPrompt.includes('1: first line'));
  assert('limit-only: line 3 present', limPrompt.includes('3: third line'));
  assert('limit-only: does not include line 4', !limPrompt.includes('4: fourth'));
  assert(
    'limit-only: 3 lines injected',
    (limPrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_LIMIT_ONLY_LINES
  );
}

/**
 * Scenario 9: object format with both offset and limit (offset=3, limit=4 -> lines 3-6).
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertOffsetAndLimit(hooks: HookMap): Promise<void> {
  const both = {
    args: {
      prompt: 'V',
      files: [{ path: FIXTURE_LINES_PATH, offset: 3, limit: 4 }],
    },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, both);
  const bothPrompt = both.args.prompt ?? '';
  assert('both: line 3 present', bothPrompt.includes('3: third line'));
  assert('both: line 6 present', bothPrompt.includes('6: sixth line'));
  assert('both: does not include line 2', !bothPrompt.includes('2: second line'));
  assert('both: does not include line 7', !bothPrompt.includes('7: seventh line'));
  assert(
    'both: 4 lines injected',
    (bothPrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_OFFSET_AND_LIMIT_LINES
  );
}

/**
 * Scenario 10: an invalid offset (< 1) produces a skip note.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertInvalidOffset(hooks: HookMap): Promise<void> {
  const badOff = {
    args: { prompt: 'W', files: [{ path: FIXTURE_LINES_PATH, offset: 0 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, badOff);
  const badOffPrompt = badOff.args.prompt ?? '';
  assert('invalid-offset: skip note present', badOffPrompt.includes('Skipped'));
  assert(
    'invalid-offset: mentions offset',
    badOffPrompt.includes('offset must be an integer >= 1')
  );
  assert('invalid-offset: file content not injected', !badOffPrompt.includes('first line'));
}

/**
 * Scenario 11: an invalid limit (< 1) produces a skip note.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertInvalidLimit(hooks: HookMap): Promise<void> {
  const badLim = {
    args: { prompt: 'X', files: [{ path: FIXTURE_LINES_PATH, limit: 0 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, badLim);
  const badLimPrompt = badLim.args.prompt ?? '';
  assert('invalid-limit: skip note present', badLimPrompt.includes('Skipped'));
  assert('invalid-limit: mentions limit', badLimPrompt.includes('limit must be an integer >= 1'));
  assert('invalid-limit: file content not injected', !badLimPrompt.includes('first line'));
}

/**
 * Scenario 12: an offset beyond EOF produces a skip note, not a silent empty section.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertOffsetBeyondEof(hooks: HookMap): Promise<void> {
  const beyond = {
    args: { prompt: 'Y', files: [{ path: FIXTURE_LINES_PATH, offset: 20 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, beyond);
  const beyondPrompt = beyond.args.prompt ?? '';
  assert('beyond-eof: skip note present', beyondPrompt.includes('Skipped'));
  assert(
    'beyond-eof: mentions offset exceeding file length',
    beyondPrompt.includes('offset 20 exceeds file length (10 lines)')
  );
  assert('beyond-eof: file content not injected', !beyondPrompt.includes('first line'));
}

/**
 * Scenario 13: a limit exceeding the remaining lines gracefully injects available lines.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertLimitExceedingRemaining(hooks: HookMap): Promise<void> {
  const exceed = {
    args: {
      prompt: 'Z',
      files: [{ path: FIXTURE_LINES_PATH, offset: 8, limit: 10 }],
    },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, exceed);
  const exceedPrompt = exceed.args.prompt ?? '';
  assert('exceed-limit: line 8 present', exceedPrompt.includes('8: eighth line'));
  assert('exceed-limit: line 10 present', exceedPrompt.includes('10: tenth line'));
  assert(
    'exceed-limit: only 3 lines injected',
    (exceedPrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_REMAINING_LINES
  );
  assert('exceed-limit: does not include line 11', !exceedPrompt.includes('11:'));
}

/**
 * Scenario 14: an empty file produces a skip note.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertEmptyFile(hooks: HookMap): Promise<void> {
  const emptyRelativePath = '.opencode/plugins/tests/fixtures/empty.tmp';
  const emptyAbsolutePath = path.resolve(WORKTREE, emptyRelativePath);
  await writeFile(emptyAbsolutePath, '');
  const empty = { args: { prompt: 'A', files: [emptyRelativePath] } };
  try {
    await hooks['tool.execute.before']({ tool: 'task' }, empty);
  } finally {
    await removeIfExists(emptyAbsolutePath);
  }
  const emptyPrompt = empty.args.prompt ?? '';
  assert('empty-file: skip note present', emptyPrompt.includes('Skipped'));
  assert('empty-file: mentions 0 lines', emptyPrompt.includes('0 lines'));
  assert('empty-file: no numbered lines injected', !/\n\d+: /.test(emptyPrompt));
}

/**
 * Scenario 15: duplicate paths with different ranges — both ranges are injected.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertDuplicateRanges(hooks: HookMap): Promise<void> {
  const dupe = {
    args: {
      prompt: 'B',
      files: [
        { path: FIXTURE_LINES_PATH, offset: 1, limit: 2 },
        { path: FIXTURE_LINES_PATH, offset: 5, limit: 2 },
      ],
    },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, dupe);
  const dupePrompt = dupe.args.prompt ?? '';
  assert('dupe-range: first range (line 1) present', dupePrompt.includes('1: first line'));
  assert('dupe-range: first range (line 2) present', dupePrompt.includes('2: second line'));
  assert('dupe-range: second range (line 5) present', dupePrompt.includes('5: fifth line'));
  assert('dupe-range: second range (line 6) present', dupePrompt.includes('6: sixth line'));
  assert(
    'dupe-range: 4 lines total',
    (dupePrompt.match(/\n\d+: /g) ?? []).length === FIXTURE_DUPLICATE_RANGES_LINES
  );
  assert('dupe-range: does not include line 3', !dupePrompt.includes('3: third'));
}

/**
 * Scenario 16: a non-integer offset produces a skip note.
 *
 * @param {HookMap} hooks - The loaded plugin hooks.
 */
async function assertNonIntegerOffset(hooks: HookMap): Promise<void> {
  const nonInt = {
    args: { prompt: 'C', files: [{ path: FIXTURE_LINES_PATH, offset: 1.5 }] },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, nonInt);
  const nonIntPrompt = nonInt.args.prompt ?? '';
  assert('nonint-offset: skip note present', nonIntPrompt.includes('Skipped'));
  assert('nonint-offset: mentions non-integer', nonIntPrompt.includes('offset must be an integer'));
  assert('nonint-offset: file content not injected', !nonIntPrompt.includes('first line'));
}

/**
 * Run every regression scenario against the loaded plugin hooks.
 *
 * @returns {Promise<number>} The number of failed assertions (zero when the harness is green).
 */
export async function run(): Promise<number> {
  const hooks = await loadPlugin();

  await assertDefinitionHooks(hooks);
  await assertOrderedInjection(hooks);
  await assertEscapedPathSkipped(hooks);
  await assertNoFilesUntouched(hooks);
  await assertMissingFilesRejected(hooks);
  await assertOversizedSkipped(hooks);
  await assertStringPathBackCompat(hooks);
  await assertOffsetOnly(hooks);
  await assertLimitOnly(hooks);
  await assertOffsetAndLimit(hooks);
  await assertInvalidOffset(hooks);
  await assertInvalidLimit(hooks);
  await assertOffsetBeyondEof(hooks);
  await assertLimitExceedingRemaining(hooks);
  await assertEmptyFile(hooks);
  await assertDuplicateRanges(hooks);
  await assertNonIntegerOffset(hooks);

  return failedAssertions.length;
}

const isMain = argv[1] !== undefined && import.meta.url === pathToFileURL(argv[1]).href;
if (isMain) {
  test('task-files plugin regression harness', async () => {
    const failed = await run();
    if (failed !== 0) {
      throw new Error(`${failed} assertion(s) failed: ${failedAssertions.join('; ')}`);
    }
  });
}
