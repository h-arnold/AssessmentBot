import type { Plugin } from '@opencode-ai/plugin';
import { resolve, relative, isAbsolute } from 'node:path';

// The task tool defines an explicit `jsonSchema` (packages/opencode/src/tool/task.ts),
// so the `files` parameter must be added to BOTH `output.parameters` (the model-facing
// definition) and `output.jsonSchema` (the parse schema). Patching only `parameters`
// would be ignored at parse time and the model's `files` argument would be stripped.
const MAX_FILE_BYTES = 256 * 1024;

interface NormalisedEntry {
  path: string;
  offset: number;
  limit?: number;
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
    "Optional list of file paths (relative to the project worktree) to read and inject into this task's context as compulsory reading. The subagent receives the file contents directly, so it does not need to issue read calls for them. Paths are sorted alphabetically before injection to keep the injected content deterministic for prompt caching. Each entry can be a string path or an object with `path` (string), `offset` (1-indexed start line, optional), and `limit` (max lines, optional).",
};

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

  const obj = item as Record<string, unknown>;

  if (typeof obj.path !== 'string') {
    return {
      path: String(obj.path ?? ''),
      offset: 1,
      skipNote: `path must be a string, got ${typeof obj.path}`,
    };
  }

  const offsetVal = obj.offset !== undefined ? obj.offset : 1;
  const limitVal = obj.limit !== undefined ? obj.limit : undefined;

  if (typeof offsetVal !== 'number' || !Number.isInteger(offsetVal) || offsetVal < 1) {
    return {
      path: obj.path,
      offset: 1,
      skipNote: `offset must be an integer >= 1, got ${JSON.stringify(obj.offset)}`,
    };
  }

  if (
    limitVal !== undefined &&
    (typeof limitVal !== 'number' || !Number.isInteger(limitVal) || limitVal < 1)
  ) {
    return {
      path: obj.path,
      offset: 1,
      skipNote: `limit must be an integer >= 1, got ${JSON.stringify(obj.limit)}`,
    };
  }

  return { path: obj.path, offset: offsetVal as number, limit: limitVal as number | undefined };
}

export default (async ({ worktree, directory }) => {
  const root = worktree || directory;

  return {
    'tool.definition': async (input, output) => {
      if (input.toolID !== 'task') return;

      const params = output.parameters as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      params.properties = { ...(params.properties ?? {}), files: FILES_PARAMETER };
      params.required = Array.isArray(params.required)
        ? params.required.filter((name) => name !== 'files')
        : params.required;

      const js = (
        output as unknown as {
          jsonSchema?: { properties?: Record<string, unknown>; required?: string[] };
        }
      ).jsonSchema;
      if (js && typeof js === 'object') {
        (output as unknown as { jsonSchema: unknown }).jsonSchema = {
          ...js,
          properties: { ...(js.properties ?? {}), files: FILES_PARAMETER },
          required: Array.isArray(js.required)
            ? js.required.filter((name) => name !== 'files')
            : js.required,
        };
      }

      output.description =
        (output.description ?? '') +
        "\n\nSupports an optional `files` array of paths (relative to the project worktree). Each named file is read and concatenated into this task's context as compulsory reading, so the subagent does not need to issue read calls for them. Paths are sorted alphabetically before injection to keep the injected content deterministic for prompt caching.";
    },

    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'task') return;
      const files = (output.args as { files?: unknown }).files;
      if (!Array.isArray(files) || files.length === 0) return;

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
        return pc !== 0 ? pc : a.offset - b.offset;
      });

      const blocks: string[] = [];
      for (const entry of ordered) {
        if (entry.skipNote) {
          blocks.push(`### ${entry.path}\n(Skipped: ${entry.skipNote})`);
          continue;
        }

        const target = resolve(root, entry.path);
        const rel = relative(root, target);
        if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
          blocks.push(`### ${entry.path}\n(Skipped: path resolves outside the project worktree.)`);
          continue;
        }
        const handle = Bun.file(target);
        let size: number;
        try {
          size = (await handle.stat()).size;
        } catch {
          blocks.push(`### ${rel}\n(Skipped: file could not be read.)`);
          continue;
        }
        if (size > MAX_FILE_BYTES) {
          blocks.push(
            `### ${rel}\n(Skipped: file is ${size} bytes, exceeding the ${MAX_FILE_BYTES}-byte limit.)`
          );
          continue;
        }
        let content: string;
        try {
          content = await handle.text();
        } catch {
          blocks.push(`### ${rel}\n(Skipped: file could not be read.)`);
          continue;
        }

        // Apply offset/limit and format with line numbers
        const allLines = content.split('\n');
        // Remove trailing empty element from a final newline
        const lines = allLines[allLines.length - 1] === '' ? allLines.slice(0, -1) : allLines;

        const startIdx = entry.offset - 1; // convert to 0-indexed
        if (startIdx >= lines.length) {
          blocks.push(
            `### ${rel}\n(Skipped: offset ${entry.offset} exceeds file length (${lines.length} lines).)`
          );
          continue;
        }
        const slice =
          entry.limit !== undefined
            ? lines.slice(startIdx, startIdx + entry.limit)
            : lines.slice(startIdx);

        const numbered = slice.map((line, i) => `${entry.offset + i}: ${line}`).join('\n');

        blocks.push(`### ${rel}\n${numbered}`);
      }

      delete (output.args as { files?: unknown }).files;

      if (blocks.length === 0) return;

      const attachment = [
        '## Attached files (compulsory reading — provided automatically, do not re-read)',
        '',
        ...blocks,
        '',
        '---',
        '',
      ].join('\n');

      const args = output.args as { prompt?: string };
      args.prompt = attachment + (args.prompt ?? '');
    },
  };
}) satisfies Plugin;
