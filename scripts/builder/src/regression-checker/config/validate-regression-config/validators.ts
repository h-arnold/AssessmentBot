/**
 * Supported tool families and validation functions.
 *
 * @module
 */

const SUPPORTED_TOOLS = ['eslint', 'vitest', 'playwright', 'tsc'] as const;

type RegressionTool = (typeof SUPPORTED_TOOLS)[number];

/**
 * Validates a supported tool family name.
 *
 * @param {string} tool - Configured check tool family.
 * @returns {void}
 */
function validateTool(tool: string): asserts tool is RegressionTool {
  if ((SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return;
  }

  throw new Error(`Unsupported tool family configured: ${tool}`);
}

/**
 * Validates an optional explicit reporter mode.
 *
 * @param {RegressionTool} tool - Check tool family.
 * @param {string | undefined} reporterMode - Optional configured reporter mode.
 * @returns {void}
 */
function validateReporterMode(tool: RegressionTool, reporterMode: string | undefined): void {
  if (reporterMode === undefined) {
    return;
  }

  switch (tool) {
    case 'eslint':
    case 'vitest':
    case 'playwright':
      if (reporterMode === 'json') {
        return;
      }
      break;
    case 'tsc':
      break;
  }

  throw new Error(`Unsupported reporter mode configured for tool=${tool}: ${reporterMode}`);
}

export { SUPPORTED_TOOLS, validateTool, validateReporterMode };
export type { RegressionTool };
