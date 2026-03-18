import type { FrontendBuildMode } from '../types.js';

export type BuilderCliOptions = {
  frontendMode: FrontendBuildMode;
};

const FRONTEND_MODE_FLAG = '--frontend-mode';
const FRONTEND_MODE_FLAG_PREFIX = `${FRONTEND_MODE_FLAG}=`;

/**
 * Parses supported CLI options for the builder entrypoint.
 *
 * @param {string[]} args - Raw process arguments excluding node/script paths.
 * @returns {BuilderCliOptions} Parsed options.
 */
export function parseCliOptions(args: string[]): BuilderCliOptions {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg.startsWith(FRONTEND_MODE_FLAG_PREFIX)) {
      return { frontendMode: parseFrontendMode(arg.slice(FRONTEND_MODE_FLAG_PREFIX.length)) };
    }

    if (arg === FRONTEND_MODE_FLAG) {
      return { frontendMode: parseFrontendMode(args[index + 1]) };
    }
  }

  return { frontendMode: 'production' };
}

/**
 * Validates and parses frontend mode values.
 *
 * @param {string | undefined} mode - Mode token from CLI input.
 * @returns {FrontendBuildMode} Parsed frontend build mode.
 */
function parseFrontendMode(mode: string | undefined): FrontendBuildMode {
  if (mode === 'production' || mode === 'dev') {
    return mode;
  }

  throw new Error("Invalid --frontend-mode value. Expected 'production' or 'dev'.");
}
