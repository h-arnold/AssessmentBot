import type { Plugin } from '@opencode-ai/plugin';

const SILENCE_PATTERNS = [
  /eslint-disable(?:-next-line|-line)?/i,
  /@ts-ignore/i,
  /@ts-nocheck/i,
  /@ts-expect-error/i,
  /noqa/i,
  /type:\s*ignore/i,
];

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.vue',
  '.svelte',
]);

/**
 * Check whether a piece of source text contains a lint/TS silencing rule.
 *
 * @param {string} text - The source text to inspect.
 * @returns {string | null} The matched silencing pattern source, or null when none is found.
 */
function hasSilencingRule(text: string): string | null {
  for (const pattern of SILENCE_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

/**
 * Determine whether a file path should be checked for silencing rules.
 *
 * @param {string | undefined} filePath - The file path being written or edited.
 * @returns {boolean} True when the path is a source file outside the plugin directory.
 */
function isSourceFile(filePath: string | undefined): boolean {
  if (!filePath) return false;
  if (filePath.includes('/.opencode/plugins/')) return false;
  return SOURCE_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf('.')));
}

export default (async () => {
  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool === 'edit') {
        if (!isSourceFile(output.args.filePath)) return;
        const match = hasSilencingRule(output.args.newString);
        if (match) {
          throw new Error(
            `Blocked edit: new text contains a lint/ts silencing rule (${match}). ` +
              `Disabling eslint/ts lint rules through this construct is blocked. ` +
              `Fix the underlying issue rather than suppressing the warning. ` +
              `If you are unable to address the underlying issue, stop work and hand back to the user to ask for permission, explaining why there is no other way around the rule.`
          );
        }
      }

      if (input.tool === 'write') {
        if (!isSourceFile(output.args.filePath)) return;
        const match = hasSilencingRule(output.args.content);
        if (match) {
          throw new Error(
            `Blocked write: content contains a lint/ts silencing rule (${match}). ` +
              `Disabling eslint/ts lint rules through this construct is blocked. ` +
              `Fix the underlying issue rather than suppressing the warning. ` +
              `If you are unable to address the underlying issue, stop work and hand back to the user to ask for permission, explaining why there is no other way around the rule.`
          );
        }
      }
    },
  };
}) satisfies Plugin;
