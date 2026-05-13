export type SessionIdSource = 'arg' | 'git-branch';

export type SessionContext = {
  sessionId: string;
  sessionIdSource: SessionIdSource;
};

export type ResolveSessionContextOptions = {
  positionalSessionId: string | undefined;
  resolveGitBranchName: () => Promise<string>;
};

/**
 * Resolves the active session context from CLI input or git branch fallback.
 *
 * @param {ResolveSessionContextOptions} options - Session resolution dependencies and raw input.
 * @returns {Promise<SessionContext>} Resolved session identifier and source metadata.
 */
export async function resolveSessionContext(
  options: ResolveSessionContextOptions
): Promise<SessionContext> {
  if (options.positionalSessionId !== undefined) {
    return {
      sessionId: options.positionalSessionId,
      sessionIdSource: 'arg',
    };
  }

  try {
    const branchName = await options.resolveGitBranchName();
    return {
      sessionId: branchName,
      sessionIdSource: 'git-branch',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to resolve sessionId from git branch. Ensure the repository is not in detached HEAD mode. (${message})`,
      { cause: error }
    );
  }
}
