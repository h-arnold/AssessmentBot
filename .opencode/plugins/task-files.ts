import type { Plugin } from '@opencode-ai/plugin';
import { resolve, relative, isAbsolute } from 'node:path';

// The task tool defines an explicit `jsonSchema` (packages/opencode/src/tool/task.ts),
// so the `files` parameter must be added to BOTH `output.parameters` (the model-facing
// definition) and `output.jsonSchema` (the parse schema). Patching only `parameters`
// would be ignored at parse time and the model's `files` argument would be stripped.
const MAX_FILE_BYTES = 256 * 1024;

const FILES_PARAMETER = {
  type: 'array',
  items: { type: 'string' },
  description:
    "Optional list of file paths (relative to the project worktree) to read and inject into this task's context as compulsory reading. The subagent receives the file contents directly, so it does not need to issue read calls for them. Paths are sorted alphabetically before injection to keep the injected content deterministic for prompt caching.",
};

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

      const ordered = [...new Set(files.filter((f): f is string => typeof f === 'string'))].sort(
        (a, b) => a.localeCompare(b)
      );

      const blocks: string[] = [];
      for (const file of ordered) {
        const target = resolve(root, file);
        const rel = relative(root, target);
        if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
          blocks.push(`### ${file}\n(Skipped: path resolves outside the project worktree.)`);
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
        blocks.push(`### ${rel}\n${content}`);
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
