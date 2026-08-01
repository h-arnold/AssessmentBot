# task-files plugin

A local opencode plugin that extends the built-in `task` tool with an optional `files` argument
(a list of worktree-relative paths). Each named file is read and concatenated into the subagent's
`prompt` as **compulsory reading**, so the subagent receives the contents directly and does not
need to issue its own `read` calls for them.

## Why

Subagents are often handed a list of files to study. Without this plugin they spend a tool
round-trip (or several) reading each file. Passing the paths through `files` injects the content up
front, saving latency and the tokens on those round trips.

## How it works

The plugin registers two hooks against the built-in `task` tool. It does **not** replace the tool.

### `tool.definition`

Advertises the `files` parameter to the model. Because the `task` tool ships an explicit
`jsonSchema`, the parameter is added to **both** `output.parameters` (the model-facing definition)
and `output.jsonSchema` (the parse schema). Patching only `parameters` would be silently dropped at
parse time, so the model's `files` argument would never reach the next hook.

### `tool.execute.before`

Runs after argument parsing but before the built-in tool executes. It:

1. Reads `args.files` (ignored unless it is a non-empty array).
2. Normalises each entry to a `{ path, offset, limit }` shape. Entries can be:
   - A plain string (equivalent to `{ path: '<string>', offset: 1 }`).
   - An object with `path` (required), `offset` (1-indexed start line, optional, default 1),
     and `limit` (maximum lines, optional, default all remaining).
3. Sorts the entries alphabetically by path (then by offset) and de-duplicates them by
   (path, offset, limit) — first occurrence wins. Deterministic ordering keeps the injected
   text byte-stable, which matters for prompt caching across repeated identical task calls.
4. Resolves each path against the session worktree and reads the file.
5. Applies the optional `offset`/`limit` to select a subset of lines, then formats every injected
   line with its 1-indexed line number (e.g. `1: first line`), matching the `read` tool's output
   format so the subagent can make precise line references.
6. Prepends a `## Attached files` block (each file under a `### <relative-path>` heading), then a
   `---` separator, then the original `prompt`.
7. Deletes `args.files` so the built-in tool never sees it.

### Safety and resilience

- **Worktree confinement.** A path that resolves outside the project worktree (e.g. `../etc/passwd`)
  is skipped with a visible note, never read.
- **Missing files** are skipped with a visible `(Skipped: file could not be read.)` note.
- **Oversized files** (above `MAX_FILE_BYTES`, 256 KB) are skipped with a visible note stating the
  size and the limit.
- **Invalid offset/limit** values (e.g. `offset: 0` or `limit: -1`) produce a visible skip note
  with the reason, never silently ignored.
- **Offset beyond EOF** produces a visible skip note stating the offset and file length, never
  a silent empty section.
- Skipped files are reported inline rather than silently dropped — errors are never swallowed.

## Usage

From any agent that can call `task`, add a `files` array of worktree-relative paths. Each entry can
be a plain string path or an object with `path`, `offset` (1-indexed start line), and `limit`
(maximum lines to inject).

### String entries (entire file)

```json
{
  "description": "Summarise the config loader",
  "prompt": "Summarise what the config loader does and list its public exports.",
  "subagent_type": "general",
  "files": ["src/backend/config/loader.ts", "src/backend/config/types.ts"]
}
```

### Object entries (line range)

```json
{
  "description": "Review the validate function",
  "prompt": "Tell me if the validate function has any bugs.",
  "subagent_type": "general",
  "files": [{ "path": "src/backend/config/validator.ts", "offset": 42, "limit": 30 }]
}
```

The subagent receives, ahead of your `prompt`, a block such as:

```
## Attached files (compulsory reading — provided automatically, do not re-read)

### src/backend/config/loader.ts
1: import ...
2: ...
...

### src/backend/config/validator.ts
42: function validate(input) {
43:   ...
...
71: }

---
Summarise what the config loader does and list its public exports.
```

Every injected line is prefixed with its 1-indexed line number (matching the `read` tool's format).
When `offset` is specified, line numbers reflect the actual file positions (e.g. `offset: 42`
produces `42:`, `43:`, ...).

The order of the `files` array in the call does not affect injection order — files are always
injected alphabetically by path (then by offset for multiple ranges of the same file).

## Operational notes

- **Restart required.** opencode does not hot-reload plugins; the plugin only takes effect after
  opencode is restarted.
- **256 KB per-file cap.** `MAX_FILE_BYTES` guards against blowing up the context window. Raise it
  in `task-files.ts` if you have a deliberate need for larger injections.
- **Editor type noise.** The plugin references the `Bun` global, provided by opencode's bundled Bun
  at runtime. Editors without `@types/bun` in scope may underline it as unresolved; this is cosmetic
  and does not affect loading. (`node:path` is covered by `@types/node`, which the lint-only
  `.opencode/tsconfig.json` project wires in.)
- **Lint coverage.** The plugin tree is linted to the same standard as the builder scripts (see
  `scripts/builder/eslint.config.js` and `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`);
  `npm run lint:builder:check` covers `.opencode/plugins`, and the pre-commit hook routes staged plugin
  files through the same ESLint config.

## Testing

A deterministic regression harness lives alongside the plugin:

```
.opencode/plugins/tests/task-files.test.ts
.opencode/plugins/tests/fixtures/alpha.txt
.opencode/plugins/tests/fixtures/beta.txt
.opencode/plugins/tests/fixtures/lines.txt
```

The harness runs under `node:test`. Run it with plain Node (Bun is not required — the harness
shims the single `Bun.file` call):

```bash
node .opencode/plugins/tests/task-files.test.ts
```

It asserts that `tool.definition` adds `files` to both schemas, that `tool.execute.before`
constructs the injected prompt in alphabetical order while preserving the original instruction and
stripping `args.files`, that worktree escapes are refused, that an empty `files` list leaves the
prompt untouched, that string and object entry formats both work, that `offset`/`limit` selections
produce correct line numbers, that invalid offset/limit values produce visible skip notes, that
offset beyond EOF produces a skip note, that limit exceeding remaining lines injects available lines
only, that empty files produce a skip note, that duplicate paths with different ranges are both
injected, and that non-integer offset/limit values produce skip notes.
