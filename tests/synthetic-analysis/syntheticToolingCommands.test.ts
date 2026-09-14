import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type PackageManifest = {
  scripts: Record<string, string>;
};

type VitestProject = {
  test?: {
    name?: string;
    environment?: string;
    setupFiles?: string | string[];
    include?: string[];
    exclude?: string[];
    testTimeout?: number;
  };
};

type VitestConfig = {
  test?: {
    projects?: VitestProject[];
  };
};

type EslintConfigEntry = {
  files?: string | string[];
  ignores?: string | string[];
  languageOptions?: {
    sourceType?: string;
    parser?: unknown;
  };
  rules?: Record<string, unknown>;
};

type SharedEslintRulesModule = {
  nodeToolingRules?: Record<string, unknown>;
};

const SYNTHETIC_SCRIPT_PATH = 'scripts/synthetic-test-data';
const SYNTHETIC_TEST_PATH = 'tests/synthetic-analysis';
const SYNTHETIC_TEST_GLOB = 'tests/synthetic-analysis/**/*.test.ts';
const SYNTHETIC_STRESS_TEST_GLOB = 'tests/synthetic-analysis-stress/**/*.test.ts';
const SYNTHETIC_STRESS_PROJECT = 'synthetic-analysis-stress';
const SETUP_GLOBALS_PATH = 'tests/setupGlobals.js';
const ROOT_TEST_INCLUDE = 'tests/**/*.test.js';
const ROOT_ESLINT_CONFIG = 'eslint.config.js';
const BUILDER_ESLINT_CONFIG = 'scripts/builder/eslint.config.js';
const BUILDER_SCRIPT_PATH = 'scripts/builder/src';
const SHARED_RULES_MODULE = 'config/eslint/ts-base-rules.cjs';

const nodeRequire = createRequire(import.meta.url);
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const packageManifest = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8')
) as PackageManifest;
const vitestConfig = nodeRequire(join(repositoryRoot, 'vitest.config.js')) as VitestConfig;
const eslintConfig = nodeRequire(join(repositoryRoot, 'eslint.config.js')) as EslintConfigEntry[];
// The builder config already owns the rules applied to every other file under
// `scripts/`; the synthetic scripts must reuse that same canonical source.
const builderEslintConfig = loadEslintConfig(BUILDER_ESLINT_CONFIG);

/**
 * Normalises an ESLint/Vitest pattern field into an array.
 *
 * @param patterns A single pattern or an array of patterns.
 * @returns The patterns as an array.
 */
function toPatternList(patterns: string | string[] | undefined): string[] {
  if (patterns === undefined) {
    return [];
  }

  return Array.isArray(patterns) ? patterns : [patterns];
}

/**
 * Splits a package script into its `&&`-separated shell steps.
 *
 * @param command The package script command to split.
 * @returns The trimmed, non-empty steps of the command.
 */
function splitCommandSteps(command: string): string[] {
  return command
    .split('&&')
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

/**
 * Lists the npm scripts invoked by `npm run <name>` inside a command.
 *
 * @param command The package script command to inspect.
 * @returns The invoked npm script names in source order.
 */
function invokedNpmScripts(command: string): string[] {
  return splitCommandSteps(command).flatMap((step) =>
    [...step.matchAll(/\bnpm\s+run\s+([\w:.-]+)/gu)].map((match) => match[1])
  );
}

/**
 * Resolves every npm script reachable from the supplied root scripts.
 *
 * @param rootScriptNames The package script names to start from.
 * @returns The set of reachable npm script names, including the roots.
 */
function reachableNpmScripts(rootScriptNames: string[]): Set<string> {
  const visited = new Set<string>();
  const pending = [...rootScriptNames];

  while (pending.length > 0) {
    const scriptName = pending.pop();
    if (scriptName === undefined || visited.has(scriptName)) {
      continue;
    }
    visited.add(scriptName);

    const command = packageManifest.scripts[scriptName];
    if (typeof command === 'string') {
      pending.push(...invokedNpmScripts(command));
    }
  }

  return visited;
}

/**
 * Tokenises a shell command into whitespace-separated arguments.
 *
 * @param command The shell command to tokenise.
 * @returns The command's argument tokens.
 */
function tokenizeCommand(command: string): string[] {
  return command.match(/\S+/gu) ?? [];
}

/**
 * Reports whether an ESLint argument list pins the warning budget to zero.
 *
 * @param tokens The tokenised ESLint command.
 * @returns True when `--max-warnings` is set to exactly `0`.
 */
function hasZeroWarningBudget(tokens: string[]): boolean {
  if (tokens.includes('--max-warnings=0')) {
    return true;
  }

  const maxWarningsIndex = tokens.indexOf('--max-warnings');
  return maxWarningsIndex !== -1 && tokens[maxWarningsIndex + 1] === '0';
}

/**
 * Lists the Vitest project names bound to the synthetic spec glob.
 *
 * @returns The configured synthetic project names.
 */
function syntheticVitestProjectNames(): string[] {
  return syntheticVitestProjects()
    .map((project) => project.test?.name)
    .filter((name): name is string => typeof name === 'string');
}

/**
 * Lists the Vitest projects whose include glob is the synthetic spec glob.
 *
 * @returns The matching Vitest projects.
 */
function syntheticVitestProjects(): VitestProject[] {
  return (vitestConfig.test?.projects ?? []).filter((project) =>
    toPatternList(project.test?.include).includes(SYNTHETIC_TEST_GLOB)
  );
}

/**
 * Reports whether a tokenised command invokes the `vitest run` one-off runner.
 *
 * @param tokens The tokenised command.
 * @returns True when the command contains a contiguous `vitest run` invocation.
 */
function invokesVitestRun(tokens: string[]): boolean {
  return tokens.some((token, index) => token === 'vitest' && tokens[index + 1] === 'run');
}

/**
 * Reports whether a tokenised command selects the synthetic specs by path or project.
 *
 * @param tokens The tokenised Vitest command.
 * @returns True when the command targets the synthetic spec path or dedicated project.
 */
function targetsSyntheticDomain(tokens: string[]): boolean {
  const projectNames = syntheticVitestProjectNames();
  const targetsSyntheticFixturePath = tokens.some(
    (token) => token === SYNTHETIC_TEST_PATH || token.startsWith(`${SYNTHETIC_TEST_PATH}/`)
  );
  const targetsSyntheticProject = selectedVitestProjects(tokens).some((name) =>
    projectNames.includes(name)
  );

  return targetsSyntheticFixturePath || targetsSyntheticProject;
}

/**
 * Extracts the project names selected by `--project` flags in a command.
 *
 * @param tokens The tokenised Vitest command.
 * @returns The explicitly selected project names.
 */
function selectedVitestProjects(tokens: string[]): string[] {
  const selected: string[] = [];

  tokens.forEach((token, index) => {
    if (token === '--project') {
      const next = tokens[index + 1];
      if (next !== undefined && !next.startsWith('-')) {
        selected.push(next);
      }
      return;
    }
    if (token.startsWith('--project=')) {
      selected.push(token.slice('--project='.length));
    }
  });

  return selected;
}

/**
 * Loads an ESLint flat-config module, unwrapping the ESM default export.
 *
 * @param configPath The repository-relative ESLint config path.
 * @returns The flat-config entries exported by the config module.
 */
function loadEslintConfig(configPath: string): EslintConfigEntry[] {
  const loaded = nodeRequire(join(repositoryRoot, configPath));
  return (Array.isArray(loaded) ? loaded : loaded.default) as EslintConfigEntry[];
}

/**
 * Lists the ESLint config paths that govern the synthetic scripts.
 *
 * Follows the gating `lint:synthetic:check` command rather than a hard-coded file.
 *
 * @returns The repository-relative config paths used for the synthetic script path.
 */
function syntheticScriptLintConfigPaths(): string[] {
  const command = packageManifest.scripts['lint:synthetic:check'] ?? '';
  const configPaths = splitCommandSteps(command)
    .filter((step) => step.includes(SYNTHETIC_SCRIPT_PATH))
    .map((step) => {
      const tokens = tokenizeCommand(step);
      const inlineConfig = tokens.find((token) => token.startsWith('--config='));
      if (inlineConfig !== undefined) {
        return inlineConfig.slice('--config='.length);
      }

      const configIndex = tokens.indexOf('--config');
      return configIndex === -1
        ? ROOT_ESLINT_CONFIG
        : (tokens[configIndex + 1] ?? ROOT_ESLINT_CONFIG);
    });

  return [...new Set(configPaths)];
}

/**
 * Selects the flat-config entries that target a repository path.
 *
 * @param entries The flat-config entries to filter.
 * @param targetPath The repository-relative path the entries must cover.
 * @returns The entries whose `files` patterns target the path.
 */
function eslintScopesTargeting(
  entries: EslintConfigEntry[],
  targetPath: string
): EslintConfigEntry[] {
  return entries.filter((entry) =>
    toPatternList(entry.files).some(
      (pattern) => pattern === targetPath || pattern.startsWith(`${targetPath}/`)
    )
  );
}

/**
 * Resolves the flat-config scopes that lint the synthetic scripts.
 *
 * @returns The synthetic-script scopes drawn from the governing configs.
 */
function syntheticScriptScopes(): EslintConfigEntry[] {
  return syntheticScriptLintConfigPaths().flatMap((configPath) =>
    eslintScopesTargeting(loadEslintConfig(configPath), SYNTHETIC_SCRIPT_PATH)
  );
}

describe('synthetic analysis lint command contract', () => {
  it('runs ESLint with --fix across both the synthetic scripts and specs', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['lint:synthetic'] ?? '');

    expect(tokens).toContain('eslint');
    expect(tokens).toContain('--fix');
    expect(tokens).toContain(SYNTHETIC_SCRIPT_PATH);
    expect(tokens).toContain(SYNTHETIC_TEST_PATH);
  });

  it('fails the check command on any warning across both synthetic paths', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['lint:synthetic:check'] ?? '');

    expect(tokens).toContain('eslint');
    expect(hasZeroWarningBudget(tokens)).toBe(true);
    expect(tokens).toContain(SYNTHETIC_SCRIPT_PATH);
    expect(tokens).toContain(SYNTHETIC_TEST_PATH);
  });
});

describe('synthetic analysis test command contract', () => {
  it('runs the backend suite against only the root Node project so synthetic specs are not run twice', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:backend'] ?? '');

    expect(invokesVitestRun(tokens)).toBe(true);
    expect(selectedVitestProjects(tokens)).toEqual(['node']);
  });

  it('runs the backend watch runner against only the root Node project so synthetic specs are not run twice', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:backend:watch'] ?? '');

    expect(tokens).toContain('vitest');
    expect(selectedVitestProjects(tokens)).toEqual(['node']);
  });

  it('runs the backend coverage runner against only the root Node project so synthetic specs are not double-counted', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:backend:coverage'] ?? '');

    expect(invokesVitestRun(tokens)).toBe(true);
    expect(tokens).toContain('--coverage');
    expect(selectedVitestProjects(tokens)).toEqual(['node']);
  });

  it('runs the Vitest one-off runner against the dedicated synthetic project rather than the root JavaScript suite', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:synthetic'] ?? '');

    expect(invokesVitestRun(tokens)).toBe(true);
    expect(tokens).not.toContain(ROOT_TEST_INCLUDE);
    expect(targetsSyntheticDomain(tokens)).toBe(true);
  });

  it('runs the Vitest one-off runner with coverage against the dedicated synthetic project', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:synthetic:coverage'] ?? '');

    expect(invokesVitestRun(tokens)).toBe(true);
    expect(tokens).toContain('--coverage');
    expect(targetsSyntheticDomain(tokens)).toBe(true);
  });

  it('provides an opt-in stress command for the dedicated full-large stress project', () => {
    const tokens = tokenizeCommand(packageManifest.scripts['test:synthetic:stress'] ?? '');

    expect(invokesVitestRun(tokens)).toBe(true);
    expect(selectedVitestProjects(tokens)).toEqual([SYNTHETIC_STRESS_PROJECT]);
  });

  it('keeps the opt-in stress project out of the normal synthetic commands', () => {
    for (const scriptName of ['test:synthetic', 'test:synthetic:coverage']) {
      const tokens = tokenizeCommand(packageManifest.scripts[scriptName] ?? '');

      expect(selectedVitestProjects(tokens)).not.toContain(SYNTHETIC_STRESS_PROJECT);
    }
  });
});

describe('synthetic analysis aggregate command wiring', () => {
  it('invokes the dedicated synthetic commands from the lint, lint:check, and test aggregates', () => {
    expect(invokedNpmScripts(packageManifest.scripts.lint ?? '')).toContain('lint:synthetic');
    expect(invokedNpmScripts(packageManifest.scripts['lint:check'] ?? '')).toContain(
      'lint:synthetic:check'
    );
    expect(invokedNpmScripts(packageManifest.scripts.test ?? '')).toContain('test:synthetic');
  });

  it('invokes the dedicated synthetic coverage command from test:coverage', () => {
    const coverageCommands = invokedNpmScripts(packageManifest.scripts['test:coverage'] ?? '');

    expect(coverageCommands).toContain('test:synthetic:coverage');
  });

  it('reaches the synthetic checks transitively from run-all-checks', () => {
    const reachable = reachableNpmScripts(['run-all-checks']);

    expect(reachable.has('lint:synthetic:check')).toBe(true);
    expect(reachable.has('test:synthetic:coverage')).toBe(true);
  });
});

describe('synthetic analysis Vitest project boundary', () => {
  it('defines exactly one dedicated Node project for the synthetic TypeScript specs', () => {
    const syntheticProjects = syntheticVitestProjects();

    expect(syntheticProjects).toHaveLength(1);
    const syntheticProject = syntheticProjects[0];
    expect(syntheticProject?.test?.name).toBeTruthy();
    expect(syntheticProject?.test?.environment).toBe('node');
    expect(toPatternList(syntheticProject?.test?.setupFiles)).toContain(SETUP_GLOBALS_PATH);
  });

  it('keeps the synthetic specs out of the root JavaScript project', () => {
    const projects = vitestConfig.test?.projects ?? [];
    const backendProject = projects.find((project) => project.test?.name === 'node');
    expect(backendProject?.test?.include).toEqual([ROOT_TEST_INCLUDE]);

    const syntheticProject = syntheticVitestProjects()[0];
    expect(
      toPatternList(syntheticProject?.test?.exclude).some((pattern) =>
        pattern.includes(SYNTHETIC_TEST_PATH)
      )
    ).toBe(false);
  });

  it('defines the opt-in stress project with the full-large spec glob and an explicit budget', () => {
    const stressProject = (vitestConfig.test?.projects ?? []).find(
      (project) => project.test?.name === SYNTHETIC_STRESS_PROJECT
    );

    expect(stressProject).toBeDefined();
    expect(toPatternList(stressProject?.test?.include)).toEqual([SYNTHETIC_STRESS_TEST_GLOB]);
    expect(stressProject?.test?.environment).toBe('node');
    expect(toPatternList(stressProject?.test?.setupFiles)).toContain(SETUP_GLOBALS_PATH);
    expect(typeof stressProject?.test?.testTimeout).toBe('number');
    expect(stressProject?.test?.testTimeout).toBeGreaterThan(0);
  });
});

describe('synthetic analysis ESLint scope', () => {
  it('reuses the exported shared Node-tooling rules object in both configs', () => {
    // `nodeToolingRules` must be exported once from the shared rule base and
    // referenced by identity in both the builder and synthetic script scopes.
    // A value-equivalent copy in either config must fail this contract.
    const sharedRulesModule = nodeRequire(
      join(repositoryRoot, SHARED_RULES_MODULE)
    ) as SharedEslintRulesModule;
    const sharedNodeToolingRules = sharedRulesModule.nodeToolingRules;
    expect(sharedNodeToolingRules).toBeTypeOf('object');
    expect(Object.keys(sharedNodeToolingRules ?? {}).length).toBeGreaterThan(0);

    const builderScopeUsingSharedRules = eslintScopesTargeting(
      builderEslintConfig,
      BUILDER_SCRIPT_PATH
    ).find((scope) => scope.rules === sharedNodeToolingRules);
    expect(builderScopeUsingSharedRules).toBeDefined();

    const scriptScopes = syntheticScriptScopes();
    expect(scriptScopes.length).toBeGreaterThan(0);
    for (const scope of scriptScopes) {
      expect(scope.rules).toBe(sharedNodeToolingRules);
    }
  });

  it('lints the synthetic scripts as Node ESM modules', () => {
    const scriptScopes = syntheticScriptScopes();

    expect(scriptScopes.length).toBeGreaterThan(0);
    for (const scope of scriptScopes) {
      expect(scope.languageOptions?.sourceType).toBe('module');
    }
  });

  it('lints the synthetic TypeScript specs with a TypeScript-aware parser', () => {
    const specScope = eslintConfig.find((entry) =>
      toPatternList(entry.files).some((pattern) => pattern.startsWith(SYNTHETIC_TEST_PATH))
    );

    expect(specScope).toBeDefined();
    expect(specScope?.languageOptions?.parser).toBeDefined();
  });

  it('does not globally ignore the synthetic scripts or specs', () => {
    const ignoredPatterns = eslintConfig.flatMap((entry) => toPatternList(entry.ignores));

    expect(
      ignoredPatterns.some(
        (pattern) =>
          pattern.includes(SYNTHETIC_SCRIPT_PATH) || pattern.includes(SYNTHETIC_TEST_PATH)
      )
    ).toBe(false);
  });

  it('lints the opt-in stress TypeScript specs with a TypeScript-aware parser', () => {
    const stressScope = eslintConfig.find((entry) =>
      toPatternList(entry.files).some((pattern) => pattern === SYNTHETIC_STRESS_TEST_GLOB)
    );

    expect(stressScope).toBeDefined();
    expect(stressScope?.languageOptions?.parser).toBeDefined();
  });
});
