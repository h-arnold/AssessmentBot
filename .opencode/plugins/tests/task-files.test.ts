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
