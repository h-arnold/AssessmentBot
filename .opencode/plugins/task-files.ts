import path from 'node:path';

import type { Plugin } from '@opencode-ai/plugin';

// Maximum injected file size in bytes (256 KiB).
const MAX_FILE_BYTES = 262_144;

interface NormalisedEntry {
  path: string;
  offset: number;
  limit?: number;
  skipNote?: string;
}

interface RangeNormalisation {
  value?: number;
  skipNote?: string;
}

const ITEMS_SCHEMA = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'integer' },
        limit: { type: 'integer' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  ],
};

const FILES_PARAMETER = {
  type: 'array',
  items: ITEMS_SCHEMA,
  description:
    "REQUIRED for every task call: worktree-relative file paths to inject into this task's context as compulsory reading. Pass an empty array (`files: []`) when the task needs no file injection. Each entry is a string path or an object with `path`, `offset` (1-indexed start line, optional), and `limit` (max lines, optional).",
};

/**
 * Validate a raw range value (offset or limit) against the entry rules.
 *
 * @param {unknown} raw - The raw offset/limit value from a files entry.
 * @param {string} label - The range name ('offset' or 'limit') used in the skip note.
 * @returns {RangeNormalisation} The validated value, or a skip note describing the failure.
 */
function normaliseRange(raw: unknown, label: string): RangeNormalisation {
  if (raw === undefined) {
    return {};
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    return {
      skipNote: `${label} must be an integer >= 1, got ${JSON.stringify(raw)}`,
    };
  }
  return { value: raw };
}

/**
 * Normalise an object-form files entry by validating its path and range properties.
 *
 * @param {Record<string, unknown>} object - The files entry object.
 * @returns {NormalisedEntry} A normalised entry, or one carrying the first skip note found.
 */
function normaliseEntryObject(object: Record<string, unknown>): NormalisedEntry {
  const pathValue = typeof object.path === 'string' ? object.path : String(object.path ?? '');
  if (typeof object.path !== 'string') {
    return {
      path: pathValue,
      offset: 1,
      skipNote: `path must be a string, got ${typeof object.path}`,
    };
  }

  const offsetResult = normaliseRange(object.offset, 'offset');
  if (offsetResult.skipNote !== undefined) {
    return {
      path: pathValue,
      offset: 1,
      skipNote: offsetResult.skipNote,
    };
  }

  const limitResult = normaliseRange(object.limit, 'limit');
  if (limitResult.skipNote !== undefined) {
    return {
      path: pathValue,
      offset: 1,
      skipNote: limitResult.skipNote,
    };
  }

  return {
    path: pathValue,
    offset: offsetResult.value ?? 1,
    limit: limitResult.value,
  };
}

/**
 * Normalise a raw `files` array entry (string or object) into a structured entry.
 *
 * @param {unknown} item - An entry from the `files` array, either a string path or an object with path/offset/limit.
 * @returns {NormalisedEntry} A normalised entry with a `path`, 1-indexed `offset`, optional `limit`, and optional `skipNote`.
 */
function normaliseEntry(item: unknown): NormalisedEntry {
  if (typeof item === 'string') {
    return { path: item, offset: 1 };
  }

  if (typeof item !== 'object' || item === null) {
    return {
      path: String(item),
      offset: 1,
      skipNote: 'each file entry must be a string or an object with a `path` property',
    };
  }

  return normaliseEntryObject(item as Record<string, unknown>);
}

/**
 * Format a file's content as numbered lines for the given entry.
 *
 * @param {string} content - The file text content.
 * @param {NormalisedEntry} entry - The normalised file entry.
 * @returns {string} The `{n}: {line}` lines, or a skip note when the offset is beyond EOF.
 */
function formatLineSlice(content: string, entry: NormalisedEntry): string {
  const allLines = content.split('\n');
  // Remove a trailing empty element produced by a final newline.
  const lines =
    allLines[allLines.length - 1] === '' ? allLines.slice(0, allLines.length - 1) : allLines;

  const startIndex = entry.offset - 1; // convert to 0-indexed
  if (startIndex >= lines.length) {
    return `(Skipped: offset ${entry.offset} exceeds file length (${lines.length} lines).)`;
  }

  const slice =
    entry.limit === undefined
      ? lines.slice(startIndex)
      : lines.slice(startIndex, startIndex + entry.limit);

  return slice.map((line, index) => `${entry.offset + index}: ${line}`).join('\n');
}

/**
 * Determine whether a path resolved against the worktree root stays inside it.
 *
 * @param {string} relativePath - The path resolved against the worktree root.
 * @returns {boolean} True when the path does not escape the worktree.
 */
function isWithinWorktree(relativePath: string): boolean {
  return !(relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath));
}

/**
 * Process a single normalised entry: read the file, apply offset/limit, and return a formatted
 * block. Skip conditions are reported inline in the block text rather than returned as null.
 *
 * @param {string} root - The project root directory path.
 * @param {NormalisedEntry} entry - The normalised file entry to process.
 * @returns {Promise<string>} A formatted markdown block string (which may contain a skip note).
 */
async function processEntry(root: string, entry: NormalisedEntry): Promise<string> {
  if (entry.skipNote) {
    return `### ${entry.path}\n(Skipped: ${entry.skipNote})`;
  }

  const target = path.resolve(root, entry.path);
  const relativePath = path.relative(root, target);
  if (!isWithinWorktree(relativePath)) {
    return `### ${entry.path}\n(Skipped: path resolves outside the project worktree.)`;
  }

  const handle = Bun.file(target);
  let size: number;
  try {
    const stat = await handle.stat();
    size = stat.size;
  } catch {
    return `### ${relativePath}\n(Skipped: file could not be read.)`;
  }
  if (size > MAX_FILE_BYTES) {
    return `### ${relativePath}\n(Skipped: file is ${size} bytes, exceeding the ${MAX_FILE_BYTES}-byte limit.)`;
  }

  let content: string;
  try {
    content = await handle.text();
  } catch {
    return `### ${relativePath}\n(Skipped: file could not be read.)`;
  }

  return `### ${relativePath}\n${formatLineSlice(content, entry)}`;
}

/**
 * Build the attachment block from normalised entries.
 *
 * @param {string[]} blocks - The formatted markdown block strings for each file.
 * @param {{ prompt?: string }} taskArguments - The task arguments object.
 * @param {string} [taskArguments.prompt] - The existing instruction text; the attachment is prepended to it.
 * @returns {string} The prompt with the attachment block prepended.
 */
function buildAttachment(blocks: string[], taskArguments: { prompt?: string }): string {
  const attachment = [
    '## Attached files (compulsory reading — provided automatically, do not re-read)',
    '',
    ...blocks,
    '',
    '---',
    '',
  ].join('\n');

  return attachment + (taskArguments.prompt ?? '');
}

/**
 * Patch the parse-time jsonSchema so the `files` parameter is accepted by the task tool.
 *
 * The task tool defines an explicit `jsonSchema` (packages/opencode/src/tool/task.ts), so the
 * `files` parameter must be added to BOTH the model-facing definition and the parse schema.
 * Patching only `parameters` would be ignored at parse time and the model's `files` argument
 * would be stripped.
 *
 * @param {unknown} output - The tool definition output object.
 */
function patchJsonSchema(output: unknown): void {
  const js = (
    output as {
      jsonSchema?: {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    }
  ).jsonSchema;
  if (js && typeof js === 'object') {
    (output as { jsonSchema?: unknown }).jsonSchema = {
      ...js,
      properties: { ...js.properties, files: FILES_PARAMETER },
      required: Array.isArray(js.required) ? [...new Set([...js.required, 'files'])] : ['files'],
    };
  }
}

/**
 * Normalise, de-duplicate and sort the raw `files` array entries.
 *
 * @param {unknown[]} files - The raw `files` argument from the task tool.
 * @returns {NormalisedEntry[]} Sorted, de-duplicated normalised entries.
 */
function normaliseFiles(files: unknown[]): NormalisedEntry[] {
  // Normalise every entry, deduplicate by (path, offset, limit), sort deterministically.
  const seen = new Set<string>();
  const ordered: NormalisedEntry[] = [];
  for (const item of files) {
    const entry = normaliseEntry(item);
    const key = `${entry.path}\0${entry.offset}\0${entry.limit ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(entry);
    }
  }
  ordered.sort((a, b) => {
    const pc = a.path.localeCompare(b.path);
    return pc === 0 ? a.offset - b.offset : pc;
  });
  return ordered;
}

export default (async ({ worktree, directory }) => {
  const root = worktree || directory;

  return {
    'tool.definition': async (input, output) => {
      if (input.toolID !== 'task') return;

      const parameters = output.parameters as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      parameters.properties = {
        ...parameters.properties,
        files: FILES_PARAMETER,
      };
      parameters.required = Array.isArray(parameters.required)
        ? [...new Set([...parameters.required, 'files'])]
        : ['files'];

      patchJsonSchema(output);

      output.description =
        (output.description ?? '') +
        '\n\nThe `files` parameter is REQUIRED: pass worktree-relative paths to inject as compulsory reading (or `files: []` when none are needed). Do not list file paths in the `prompt`; files named only in the `prompt` are not injected.';
    },
    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'task') return;
      const files = (output.args as { files?: unknown }).files;
      if (!Array.isArray(files)) return;
      if (files.length === 0) {
        delete (output.args as { files?: unknown }).files;
        return;
      }

      const ordered = normaliseFiles(files);

      const blocks: string[] = [];
      for (const entry of ordered) {
        blocks.push(await processEntry(root, entry));
      }

      delete (output.args as { files?: unknown }).files;

      if (blocks.length === 0) return;

      const taskArguments = output.args as { prompt?: string };
      taskArguments.prompt = buildAttachment(blocks, taskArguments);
    },
  };
}) satisfies Plugin;
