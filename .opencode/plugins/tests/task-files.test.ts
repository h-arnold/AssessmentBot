import { stat, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { argv } from 'node:process';

// The plugin runs under opencode's bundled Bun, which provides `Bun.file`. This regression
// harness runs under plain Node (no Bun installed in CI/test shells), so we shim the single
// Bun API the plugin touches. This is the only place a global shim is acceptable.
const bunFileShim = (path: string) => ({
  async stat() {
    const s = await stat(path);
    return { size: s.size };
  },
  async text() {
    return await readFile(path, 'utf8');
  },
});
(globalThis as unknown as { Bun: { file: typeof bunFileShim } }).Bun = { file: bunFileShim };

// Worktree root: three levels up from this file (.opencode/plugins/tests/ -> repo root).
const WORKTREE =
  process.env.OPENCODE_WORKTREE ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

type Hook = (input: Record<string, unknown>, output: Record<string, any>) => Promise<void>;
type HookMap = Record<string, Hook>;

interface ExecOutput {
  args: { prompt?: string; files?: unknown };
}

interface ToolDef {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, unknown>; required: string[] };
  jsonSchema: { type: string; properties: Record<string, unknown>; required: string[] };
}

async function loadPlugin(): Promise<HookMap> {
  const mod = (await import('../task-files.ts')) as unknown as {
    default: (input: { worktree: string; directory: string }) => Promise<HookMap>;
  };
  return mod.default({ worktree: WORKTREE, directory: WORKTREE });
}

let failures = 0;
function assert(name: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) failures++;
}

export async function run(): Promise<number> {
  const hooks = await loadPlugin();

  // 1) tool.definition must advertise `files` in BOTH the model-facing parameters and the
  //    parse-time jsonSchema (the task tool ships an explicit jsonSchema, so patching only
  //    parameters would be silently dropped at parse time).
  const baseTool: ToolDef = {
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
  await hooks['tool.definition']({ toolID: 'task' }, baseTool as unknown as Record<string, any>);
  assert('definition: parameters.files present', 'files' in baseTool.parameters.properties);
  assert('definition: jsonSchema.files present', 'files' in baseTool.jsonSchema.properties);
  assert(
    'definition: existing params preserved',
    'prompt' in baseTool.parameters.properties && 'subagent_type' in baseTool.parameters.properties
  );

  // 2) tool.execute.before constructs the injected prompt deterministically.
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
  await hooks['tool.execute.before']({ tool: 'task' }, ordered as unknown as ExecOutput);
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

  // 3) Security: a path escaping the worktree is skipped, never read or injected.
  const escaped = { args: { prompt: 'X', files: ['../etc/passwd'] } };
  await hooks['tool.execute.before']({ tool: 'task' }, escaped as unknown as ExecOutput);
  const escapedPrompt = escaped.args.prompt ?? '';
  assert('security: escape path not injected as content', !escapedPrompt.includes('root:'));
  assert(
    'security: escape produces out-of-worktree skip note',
    escapedPrompt.includes('Skipped') && escapedPrompt.includes('outside the project worktree')
  );

  // 4) No files -> prompt left untouched.
  const none = { args: { prompt: 'PLAIN', files: [] } };
  await hooks['tool.execute.before']({ tool: 'task' }, none as unknown as ExecOutput);
  assert('no-files: prompt unchanged', none.args.prompt === 'PLAIN');

  // 5) Oversized file (above the 256 KB cap) is skipped with a note, not injected.
  const MAX_FILE_BYTES = 256 * 1024;
  const oversizedRel = '.opencode/plugins/tests/fixtures/oversized.tmp';
  const oversizedAbs = resolve(WORKTREE, oversizedRel);
  await writeFile(oversizedAbs, Buffer.alloc(MAX_FILE_BYTES + 1, 0x41));
  try {
    const big = { args: { prompt: 'Y', files: [oversizedRel] } };
    await hooks['tool.execute.before']({ tool: 'task' }, big as unknown as ExecOutput);
    const bigPrompt = big.args.prompt ?? '';
    assert('oversized: not injected as content', !bigPrompt.includes('AAAA'));
    assert(
      'oversized: skip note present',
      bigPrompt.includes('Skipped') && bigPrompt.includes('byte limit')
    );
  } finally {
    await unlink(oversizedAbs).catch(() => {});
  }

  // 6) Backwards compatibility: string paths still work and get line-numbered output.
  const linesRel = '.opencode/plugins/tests/fixtures/lines.txt';
  const bc = { args: { prompt: 'S', files: [linesRel] } };
  await hooks['tool.execute.before']({ tool: 'task' }, bc as unknown as ExecOutput);
  const bcPrompt = bc.args.prompt ?? '';
  assert('backcompat: files arg removed', !('files' in bc.args));
  assert('backcompat: first line numbered', bcPrompt.includes('1: first line'));
  assert('backcompat: tenth line numbered', bcPrompt.includes('10: tenth line'));
  assert('backcompat: all 10 lines present', (bcPrompt.match(/\n\d+: /g) ?? []).length === 10);
  assert('backcompat: original instruction preserved', bcPrompt.includes('S'));

  // 7) Object format with offset only (start at line 5).
  const offsetOnly = { args: { prompt: 'T', files: [{ path: linesRel, offset: 5 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, offsetOnly as unknown as ExecOutput);
  const offPrompt = offsetOnly.args.prompt ?? '';
  assert('offset-only: starts at line 5', offPrompt.includes('5: fifth line'));
  assert('offset-only: ends at line 10', offPrompt.includes('10: tenth line'));
  assert('offset-only: does not include line 4', !offPrompt.includes('4: fourth line'));
  assert('offset-only: 6 lines injected', (offPrompt.match(/\n\d+: /g) ?? []).length === 6);

  // 8) Object format with limit only (first 3 lines).
  const limitOnly = { args: { prompt: 'U', files: [{ path: linesRel, limit: 3 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, limitOnly as unknown as ExecOutput);
  const limPrompt = limitOnly.args.prompt ?? '';
  assert('limit-only: line 1 present', limPrompt.includes('1: first line'));
  assert('limit-only: line 3 present', limPrompt.includes('3: third line'));
  assert('limit-only: does not include line 4', !limPrompt.includes('4: fourth'));
  assert('limit-only: 3 lines injected', (limPrompt.match(/\n\d+: /g) ?? []).length === 3);

  // 9) Object format with both offset and limit (offset=3, limit=4 -> lines 3-6).
  const both = { args: { prompt: 'V', files: [{ path: linesRel, offset: 3, limit: 4 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, both as unknown as ExecOutput);
  const bothPrompt = both.args.prompt ?? '';
  assert('both: line 3 present', bothPrompt.includes('3: third line'));
  assert('both: line 6 present', bothPrompt.includes('6: sixth line'));
  assert('both: does not include line 2', !bothPrompt.includes('2: second line'));
  assert('both: does not include line 7', !bothPrompt.includes('7: seventh line'));
  assert('both: 4 lines injected', (bothPrompt.match(/\n\d+: /g) ?? []).length === 4);

  // 10) Invalid offset (< 1) produces a skip note.
  const badOff = { args: { prompt: 'W', files: [{ path: linesRel, offset: 0 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, badOff as unknown as ExecOutput);
  const badOffPrompt = badOff.args.prompt ?? '';
  assert('invalid-offset: skip note present', badOffPrompt.includes('Skipped'));
  assert(
    'invalid-offset: mentions offset',
    badOffPrompt.includes('offset must be an integer >= 1')
  );
  assert('invalid-offset: file content not injected', !badOffPrompt.includes('first line'));

  // 11) Invalid limit (< 1) produces a skip note.
  const badLim = { args: { prompt: 'X', files: [{ path: linesRel, limit: 0 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, badLim as unknown as ExecOutput);
  const badLimPrompt = badLim.args.prompt ?? '';
  assert('invalid-limit: skip note present', badLimPrompt.includes('Skipped'));
  assert('invalid-limit: mentions limit', badLimPrompt.includes('limit must be an integer >= 1'));
  assert('invalid-limit: file content not injected', !badLimPrompt.includes('first line'));

  // 12) Offset beyond EOF produces a skip note, not a silent empty section.
  const beyondRel = '.opencode/plugins/tests/fixtures/lines.txt';
  const beyond = { args: { prompt: 'Y', files: [{ path: beyondRel, offset: 20 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, beyond as unknown as ExecOutput);
  const beyondPrompt = beyond.args.prompt ?? '';
  assert('beyond-eof: skip note present', beyondPrompt.includes('Skipped'));
  assert(
    'beyond-eof: mentions offset exceeding file length',
    beyondPrompt.includes('offset 20 exceeds file length (10 lines)')
  );
  assert('beyond-eof: file content not injected', !beyondPrompt.includes('first line'));

  // 13) Limit exceeding remaining lines gracefully injects available lines.
  const exceed = { args: { prompt: 'Z', files: [{ path: beyondRel, offset: 8, limit: 10 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, exceed as unknown as ExecOutput);
  const exceedPrompt = exceed.args.prompt ?? '';
  assert('exceed-limit: line 8 present', exceedPrompt.includes('8: eighth line'));
  assert('exceed-limit: line 10 present', exceedPrompt.includes('10: tenth line'));
  assert(
    'exceed-limit: only 3 lines injected',
    (exceedPrompt.match(/\n\d+: /g) ?? []).length === 3
  );
  assert('exceed-limit: does not include line 11', !exceedPrompt.includes('11:'));

  // 14) Empty file produces a skip note.
  const emptyRel = '.opencode/plugins/tests/fixtures/empty.tmp';
  const emptyAbs = resolve(WORKTREE, emptyRel);
  await writeFile(emptyAbs, '');
  try {
    const empty = { args: { prompt: 'A', files: [emptyRel] } };
    await hooks['tool.execute.before']({ tool: 'task' }, empty as unknown as ExecOutput);
    const emptyPrompt = empty.args.prompt ?? '';
    assert('empty-file: skip note present', emptyPrompt.includes('Skipped'));
    assert('empty-file: mentions 0 lines', emptyPrompt.includes('0 lines'));
    assert('empty-file: no numbered lines injected', !emptyPrompt.match(/\n\d+: /g));
  } finally {
    await unlink(emptyAbs).catch(() => {});
  }

  // 15) Duplicate path with different ranges — both ranges are injected.
  const dupe = {
    args: {
      prompt: 'B',
      files: [
        { path: beyondRel, offset: 1, limit: 2 },
        { path: beyondRel, offset: 5, limit: 2 },
      ],
    },
  };
  await hooks['tool.execute.before']({ tool: 'task' }, dupe as unknown as ExecOutput);
  const dupePrompt = dupe.args.prompt ?? '';
  assert('dupe-range: first range (line 1) present', dupePrompt.includes('1: first line'));
  assert('dupe-range: first range (line 2) present', dupePrompt.includes('2: second line'));
  assert('dupe-range: second range (line 5) present', dupePrompt.includes('5: fifth line'));
  assert('dupe-range: second range (line 6) present', dupePrompt.includes('6: sixth line'));
  assert('dupe-range: 4 lines total', (dupePrompt.match(/\n\d+: /g) ?? []).length === 4);
  assert('dupe-range: does not include line 3', !dupePrompt.includes('3: third'));

  // 16) Non-integer offset produces a skip note.
  const nonInt = { args: { prompt: 'C', files: [{ path: beyondRel, offset: 1.5 }] } };
  await hooks['tool.execute.before']({ tool: 'task' }, nonInt as unknown as ExecOutput);
  const nonIntPrompt = nonInt.args.prompt ?? '';
  assert('nonint-offset: skip note present', nonIntPrompt.includes('Skipped'));
  assert('nonint-offset: mentions non-integer', nonIntPrompt.includes('offset must be an integer'));
  assert('nonint-offset: file content not injected', !nonIntPrompt.includes('first line'));

  console.log(`\n===== CONSTRUCTED PROMPT (case 2) =====\n${prompt}`);
  console.log(`\n${failures === 0 ? 'ALL ASSERTIONS PASSED' : failures + ' ASSERTION(S) FAILED'}`);
  return failures;
}

const isMain = argv[1] !== undefined && import.meta.url === pathToFileURL(argv[1]).href;
if (isMain) {
  run().then((failed) => {
    process.exitCode = failed === 0 ? 0 : 1;
  });
}
