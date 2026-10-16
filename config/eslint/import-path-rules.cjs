/**
 * Canonical import-path depth rule and plugin (shared, single source of truth).
 *
 * Policy (root `AGENTS.md`, §2.1 Coding Principles, rule 11):
 *
 *   Use `./` or `../` (including immediate-parent descendants such as
 *   `../sibling/x`) for nearby modules; use configured aliases when reaching
 *   two or more parent traversals (for example `../../x`).
 *
 * Why a custom rule instead of the core rules:
 *
 * - `no-restricted-imports` only inspects static ESM `import`/`export`; it does
 *   not see `require()` or dynamic `import()`.
 * - `no-restricted-modules` covers `require()` but was deprecated in ESLint v7,
 *   is removed in v11, and its `patterns` cannot express a regex.
 *
 * A single custom rule therefore covers every module-loading specifier form —
 * static ESM imports/exports, dynamic `import()`, CommonJS `require()`, and the
 * Vitest mock family (`vi.mock` and friends) — from one definition.
 *
 * When the rule is given a `rootDir` and the canonical `aliases`, it also
 * autofixes: a specifier that resolves inside a configured alias target is
 * rewritten to that alias, preserving any query suffix (`?raw`). It never
 * invents an alias and never rewrites a specifier that no configured alias
 * covers, so unresolved cases stay visible as errors for review.
 *
 * See `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.
 */

const path = require('node:path');
const fs = require('node:fs');

const MESSAGE_ID = 'pathDepth';

/** Extensions tried when resolving a specifier for an `explicit` alias. */
const MODULE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json', '.ts', '.tsx'];

/** Directory index files tried when resolving a specifier for an `explicit` alias. */
const INDEX_FILES = ['index.js', 'index.mjs', 'index.cjs', 'index.ts', 'index.tsx'];

/** Vitest `vi.*` members whose first argument is a module specifier. */
const VITEST_MOCK_METHODS = new Set([
  'mock',
  'doMock',
  'unmock',
  'importActual',
  'importMock',
  'requireActual',
]);

/**
 * Canonical module aliases used by the rule's fixer, as `{ prefix, target }`
 * with `target` relative to the repository root. Kept here so the three
 * enforcement configs compose the same registry rather than restating it.
 *
 * `explicit: true` marks Node package-import aliases (`#…`). Node resolves
 * those against `package.json#imports` without extension or directory-index
 * guessing, so the fixer must emit the concrete file. Bundler aliases
 * (`@…`) are left extensionless because Vite and TypeScript resolve them.
 */
const pathAliases = {
  frontend: { prefix: '@', target: 'src/frontend/src' },
  syntheticFixtures: {
    prefix: '@synthetic',
    target: 'tests/__mocks__/data/synthetic-analysis',
  },
  backend: { prefix: '#backend', target: 'src/backend', explicit: true },
  syntheticData: {
    prefix: '#synthetic-data',
    target: 'scripts/synthetic-test-data',
    explicit: true,
  },
  testHelpers: { prefix: '#test-helpers', target: 'tests/helpers', explicit: true },
  builder: { prefix: '#builder', target: 'scripts/builder/src', explicit: true },
};

/**
 * Reports whether a specifier traverses two or more parent directories.
 *
 * The specifier is normalised first, so a leading `./` (for example
 * `./../../x`) is judged by its resolved depth rather than its literal prefix.
 * Only literal strings can be judged without resolving the import, so
 * non-literal specifiers (variables, template literals) are ignored.
 *
 * @param {unknown} specifier Import specifier as written in source.
 * @returns {boolean} True when the specifier resolves through at least two parent directories.
 */
function traversesTwoOrMoreParents(specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
    return false;
  }
  const queryIndex = specifier.search(/[?#]/);
  const pathPart = queryIndex === -1 ? specifier : specifier.slice(0, queryIndex);
  return /^(?:\.\.\/){2}/.test(`${path.posix.normalize(pathPart)}/`);
}

/**
 * Finds the concrete file a Node resolution would pick for `absolutePath`,
 * trying the path itself, then module extensions, then directory index files.
 *
 * @param {string} absolutePath Absolute path without a guaranteed extension.
 * @returns {string | null} An existing file path, or null when nothing resolves.
 */
function resolveExistingModule(absolutePath) {
  if (isFile(absolutePath)) {
    return absolutePath;
  }
  for (const extension of MODULE_EXTENSIONS) {
    const candidate = `${absolutePath}${extension}`;
    if (isFile(candidate)) {
      return candidate;
    }
  }
  for (const indexFile of INDEX_FILES) {
    const candidate = path.join(absolutePath, indexFile);
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Reports whether a path exists and is a regular file.
 *
 * @param {string} candidatePath Path to test.
 * @returns {boolean} True when the path is an existing regular file.
 */
function isFile(candidatePath) {
  try {
    return fs.statSync(candidatePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Maps a deep-relative specifier to its canonical alias, or returns `null` when
 * no configured alias covers the resolved target.
 *
 * @param {string} filename Absolute path of the importing file.
 * @param {string} specifier Relative specifier as written, including any query suffix.
 * @param {string | null} rootDir Absolute repository root, or null to disable fixing.
 * @param {Array<{ prefix: string, target: string, explicit?: boolean }>} aliases Canonical aliases.
 * @returns {string | null} The aliased specifier, or null when no alias applies.
 */
function toAliasSpecifier(filename, specifier, rootDir, aliases) {
  if (!rootDir || aliases.length === 0) {
    return null;
  }

  const queryIndex = specifier.search(/[?#]/);
  const pathPart = queryIndex === -1 ? specifier : specifier.slice(0, queryIndex);
  const suffix = queryIndex === -1 ? '' : specifier.slice(queryIndex);

  let resolved = path.resolve(path.dirname(filename), pathPart);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  const relativePosix = relative.split(path.sep).join('/');

  let best = null;
  for (const alias of aliases) {
    const matches = relativePosix === alias.target || relativePosix.startsWith(`${alias.target}/`);
    if (matches && (!best || alias.target.length > best.target.length)) {
      best = alias;
    }
  }
  if (!best) {
    return null;
  }

  if (best.explicit) {
    const concrete = resolveExistingModule(resolved);
    if (!concrete) {
      return null;
    }
    resolved = concrete;
  }

  const concreteRelative = path.relative(rootDir, resolved).split(path.sep).join('/');
  if (concreteRelative === best.target) {
    return null;
  }

  const rest = concreteRelative.slice(best.target.length + 1);
  return `${best.prefix}/${rest}${suffix}`;
}

/**
 * Renders `value` as a string literal, reusing the quote character of the
 * original literal so lint fixes stay consistent with the file's style.
 *
 * @param {import('estree').Node} node Original string literal node.
 * @param {string} value Replacement string value.
 * @returns {string} A quoted JavaScript string literal.
 */
function quoteLike(node, value) {
  const quote = typeof node.raw === 'string' && node.raw.startsWith("'") ? "'" : '"';
  const escaped = value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

/** @type {import('eslint').Rule.RuleModule} */
const importPathDepthRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow relative module specifiers that traverse two or more parent directories',
      url:
        'https://github.com/h-arnold/AssessmentBot/blob/main/' +
        'docs/developer/builder/TypeScriptAndLintConfigHierarchy.md',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          rootDir: { type: 'string' },
          aliases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prefix: { type: 'string' },
                target: { type: 'string' },
                explicit: { type: 'boolean' },
              },
              required: ['prefix', 'target'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      [MESSAGE_ID]:
        'Import path traverses two or more parent directories. Use a configured module alias instead (see docs/developer/builder/TypeScriptAndLintConfigHierarchy.md).',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const rootDir = options.rootDir ?? null;
    const aliases = options.aliases ?? [];

    /**
     * Reports a literal specifier node when it traverses two or more parents,
     * attaching an alias fix when a configured alias covers its target.
     *
     * @param {import('estree').Node | null | undefined} node Node whose `value` is the specifier.
     * @returns {void}
     */
    function checkSpecifier(node) {
      if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
        return;
      }
      if (!traversesTwoOrMoreParents(node.value)) {
        return;
      }

      const replacement = toAliasSpecifier(context.filename, node.value, rootDir, aliases);
      const descriptor = { node, messageId: MESSAGE_ID };
      if (replacement) {
        descriptor.fix = (fixer) => fixer.replaceText(node, quoteLike(node, replacement));
      }
      context.report(descriptor);
    }

    return {
      ImportDeclaration(node) {
        checkSpecifier(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSpecifier(node.source);
      },
      ExportAllDeclaration(node) {
        checkSpecifier(node.source);
      },
      ImportExpression(node) {
        checkSpecifier(node.source);
      },
      CallExpression(node) {
        const { callee, arguments: callArguments } = node;
        if (callee.type === 'Identifier' && callee.name === 'require') {
          checkSpecifier(callArguments[0]);
          return;
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'vi' &&
          callee.property.type === 'Identifier' &&
          VITEST_MOCK_METHODS.has(callee.property.name)
        ) {
          checkSpecifier(callArguments[0]);
        }
      },
    };
  },
};

const importPathDepthPlugin = {
  rules: {
    'path-depth': importPathDepthRule,
  },
};

module.exports = { importPathDepthPlugin, importPathDepthRule, pathAliases };
