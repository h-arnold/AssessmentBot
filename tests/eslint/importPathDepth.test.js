/**
 * Unit tests for the shared import-path depth rule
 * (`config/eslint/import-path-rules.cjs`).
 *
 * The rule flags relative module specifiers that traverse two or more parent
 * directories and, when a configured alias covers the resolved target,
 * autofixes them to that alias. These tests pin the reporting scope (static
 * ESM, dynamic `import()`, `require()` and the Vitest mock family) and the
 * fixer's resolution behaviour, including Node subpath aliases that must name
 * the concrete file.
 */
const path = require('node:path');
const { RuleTester } = require('eslint');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const { importPathDepthRule, pathAliases } = require(
  path.join(repositoryRoot, 'config/eslint', 'import-path-rules.cjs')
);

const ruleOptions = { rootDir: repositoryRoot, aliases: Object.values(pathAliases) };

/**
 * Builds an absolute filename inside the repository.
 *
 * @param {...string} segments Path segments relative to the repository root.
 * @returns {string} The absolute path.
 */
function repositoryFile(...segments) {
  return path.join(repositoryRoot, ...segments);
}

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
});

ruleTester.run('path-depth', importPathDepthRule, {
  valid: [
    {
      name: 'allows a same-directory import',
      code: "import { thing } from './thing.js';",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
    },
    {
      name: 'allows a single-parent import',
      code: "import { helper } from '../helpers/helper.js';",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
    },
    {
      name: 'allows a bare package specifier',
      code: "import { describe } from 'vitest';",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
    },
    {
      name: 'allows a leading ./ that normalises to a single parent',
      code: "import { helper } from './../helpers/helper.js';",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
    },
    {
      name: 'ignores non-literal specifiers',
      code: [
        'const specifier = process.env.MODULE_PATH;',
        'void import(specifier);',
        'void import(`../../${specifier}`);',
        'require(specifier);',
        'vi.mock(specifier);',
      ].join('\n'),
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
    },
  ],
  invalid: [
    {
      name: 'rewrites a two-parent relative import to the test-helpers alias',
      code: "import { withGlobalMocks } from '../../helpers/globalMockManager.js';",
      filename: repositoryFile('tests', 'utils', 'authService', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "import { withGlobalMocks } from '#test-helpers/globalMockManager.js';",
    },
    {
      name: 'adds the concrete extension when rewriting to a Node subpath alias',
      code: "const ABClass = require('../../src/backend/Models/ABClass');",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "const ABClass = require('#backend/Models/ABClass.js');",
    },
    {
      name: 'resolves a directory to its index file for a Node subpath alias',
      code: "const ABClassController = require('../../src/backend/y_controllers/ABClassController');",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output:
        "const ABClassController = require('#backend/y_controllers/ABClassController/index.js');",
    },
    {
      name: 'rewrites the Vitest mock family alongside imports',
      code: "vi.mock('../../../src/backend/DbManager/DbManager.js');",
      filename: repositoryFile('tests', 'api', 'apiHandler', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "vi.mock('#backend/DbManager/DbManager.js');",
    },
    {
      name: 'rewrites a frontend relative import to the bundler alias',
      code: "import { helper } from '../../test/helper';",
      filename: repositoryFile('src', 'frontend', 'src', 'features', 'classPage', 'thing.spec.ts'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "import { helper } from '@/test/helper';",
    },
    {
      name: 'preserves a query suffix when rewriting a fixture read',
      code: "import editable from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';",
      filename: repositoryFile(
        'src',
        'frontend',
        'src',
        'services',
        'assignmentDefinition',
        'thing.spec.ts'
      ),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "import editable from '@synthetic/small/editableDefinitions.json?raw';",
    },
    {
      name: 'flags but does not fix a specifier no alias covers',
      code: "const missing = require('../../lib/nowhere.js');",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: null,
    },
    {
      name: 'flags but does not fix a specifier that escapes the repository',
      code: "const outside = require('../../outside.js');",
      filename: repositoryFile('tests', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: null,
    },
    {
      name: 'rewrites a dynamic import',
      code: "const backend = import('../../src/backend/Models/ABClass');",
      filename: repositoryFile('tests', 'utils', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "const backend = import('#backend/Models/ABClass.js');",
    },
    {
      name: 'rewrites a re-export',
      code: "export { withGlobalMocks } from '../../helpers/globalMockManager.js';",
      filename: repositoryFile('tests', 'utils', 'authService', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "export { withGlobalMocks } from '#test-helpers/globalMockManager.js';",
    },
    {
      name: 'rewrites an export-all re-export',
      code: "export * from '../../helpers/globalMockManager.js';",
      filename: repositoryFile('tests', 'utils', 'authService', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "export * from '#test-helpers/globalMockManager.js';",
    },
    {
      name: 'rewrites every remaining Vitest mock-family member',
      code: [
        "vi.doMock('../../../src/backend/DbManager/DbManager.js');",
        "vi.unmock('../../../src/backend/DbManager/DbManager.js');",
        "vi.importMock('../../../src/backend/DbManager/DbManager.js');",
        "void vi.importActual('../../../src/backend/DbManager/DbManager.js');",
        "void vi.requireActual('../../../src/backend/DbManager/DbManager.js');",
      ].join('\n'),
      filename: repositoryFile('tests', 'api', 'apiHandler', 'thing.test.js'),
      options: [ruleOptions],
      errors: [
        { messageId: 'pathDepth' },
        { messageId: 'pathDepth' },
        { messageId: 'pathDepth' },
        { messageId: 'pathDepth' },
        { messageId: 'pathDepth' },
      ],
      output: [
        "vi.doMock('#backend/DbManager/DbManager.js');",
        "vi.unmock('#backend/DbManager/DbManager.js');",
        "vi.importMock('#backend/DbManager/DbManager.js');",
        "void vi.importActual('#backend/DbManager/DbManager.js');",
        "void vi.requireActual('#backend/DbManager/DbManager.js');",
      ].join('\n'),
    },
    {
      name: 'flags a deep path hidden behind a leading ./',
      code: "import { withGlobalMocks } from './../../helpers/globalMockManager.js';",
      filename: repositoryFile('tests', 'utils', 'authService', 'thing.test.js'),
      options: [ruleOptions],
      errors: [{ messageId: 'pathDepth' }],
      output: "import { withGlobalMocks } from '#test-helpers/globalMockManager.js';",
    },
  ],
});
