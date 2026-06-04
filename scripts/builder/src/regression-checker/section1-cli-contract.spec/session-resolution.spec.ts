import { describe, expect, it } from 'vitest';
import {
  loadSessionResolutionModule,
  loadConfigValidationModule,
  createValidConfig,
  REPO_ROOT,
  PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
  BASELINE_CHECK_COUNT,
} from './fixtures.js';

describe('Section 1 regression-checker CLI contract', () => {
  it('loads valid config with omitted sessionId and resolves sessionIdSource=git-branch', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const sessionContext = await resolveSessionContext({
      positionalSessionId: undefined,
      resolveGitBranchName: async () => 'feature/section-one-contract',
    });
    const config = validateRegressionConfig({
      rawConfig: createValidConfig(),
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
      logicalCpuCount: 8,
    });

    expect(sessionContext).toEqual({
      sessionId: 'feature/section-one-contract',
      sessionIdSource: 'git-branch',
    });
    expect(config.checks).toHaveLength(BASELINE_CHECK_COUNT);
  });

  it('uses explicit sessionId without git lookup and marks sessionIdSource=arg', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();

    const gitLookup = async (): Promise<string> => {
      throw new Error('git lookup should not run for explicit session IDs');
    };

    await expect(
      resolveSessionContext({
        positionalSessionId: 'manual-session-id',
        resolveGitBranchName: gitLookup,
      })
    ).resolves.toEqual({
      sessionId: 'manual-session-id',
      sessionIdSource: 'arg',
    });
  });

  it('throws a clear error when git branch lookup fails in detached HEAD mode', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();

    await expect(
      resolveSessionContext({
        positionalSessionId: undefined,
        resolveGitBranchName: async () => {
          throw new Error('detached HEAD');
        },
      })
    ).rejects.toThrow(/detached head|branch|session/i);
  });
});
