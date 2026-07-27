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

1. Reads `args.files` (ignored unless it is a non-empty array of strings).
2. Sorts the paths alphabetically and de-duplicates them. Deterministic ordering keeps the
   injected text byte-stable, which matters for prompt caching across repeated identical task calls.
3. Resolves each path against the session worktree and reads the file.
4. Prepends a `## Attached files` block (each file under a `### <relative-path>` heading), then a
   `---` separator, then the original `prompt`.
5. Deletes `args.files` so the built-in tool never sees it.

### Safety and resilience

- **Worktree confinement.** A path that resolves outside the project worktree (e.g. `../etc/passwd`)
  is skipped with a visible note, never read.
- **Missing files** are skipped with a visible `(Skipped: file could not be read.)` note.
- **Oversized files** (above `MAX_FILE_BYTES`, 256 KB) are skipped with a visible note stating the
  size and the limit.
- Skipped files are reported inline rather than silently dropped — errors are never swallowed.

## Usage

From any agent that can call `task`, add a `files` array of worktree-relative paths:

```json
{
  "description": "Summarise the config loader",
  "prompt": "Summarise what the config loader does and list its public exports.",
  "subagent_type": "general",
  "files": ["src/backend/config/loader.ts", "src/backend/config/types.ts"]
}
```

The subagent receives, ahead of your `prompt`, a block such as:

```
## Attached files (compulsory reading — provided automatically, do not re-read)

### src/backend/config/loader.ts
<file contents>

### src/backend/config/types.ts
<file contents>

---
Summarise what the config loader does and list its public exports.
```

The order of the `files` array in the call does not affect injection order — files are always
injected alphabetically by path.

## Operational notes

- **Restart required.** opencode does not hot-reload plugins; the plugin only takes effect after
  opencode is restarted.
- **256 KB per-file cap.** `MAX_FILE_BYTES` guards against blowing up the context window. Raise it
  in `task-files.ts` if you have a deliberate need for larger injections.
- **Editor type noise.** The plugin references `node:path` and the `Bun` global, both provided by
  opencode's bundled Bun at runtime. Editors without `@types/node`/`@types/bun` in scope may
  underline these as unresolved; this is cosmetic and does not affect loading.

## Testing

A deterministic regression harness lives alongside the plugin:

```
.opencode/plugins/tests/task-files.test.ts
.opencode/plugins/tests/fixtures/alpha.txt
.opencode/plugins/tests/fixtures/beta.txt
```

Run it with plain Node (Bun is not required — the harness shims the single `Bun.file` call):

```bash
node --experimental-strip-types .opencode/plugins/tests/task-files.test.ts
```

It asserts that `tool.definition` adds `files` to both schemas, that `tool.execute.before`
constructs the injected prompt in alphabetical order while preserving the original instruction and
stripping `args.files`, that worktree escapes are refused, and that an empty `files` list leaves the
prompt untouched.
