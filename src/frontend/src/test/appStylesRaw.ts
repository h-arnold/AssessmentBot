import rawAppStyles from '../index.css?inline';

export const appStylesRaw = rawAppStyles;

/**
 * Returns the declaration block for a selector from the shared app stylesheet.
 *
 * @param {string} selector The selector to inspect.
 * @returns {string} The selector declaration block.
 */
export function getCssRuleBlock(selector: string): string {
  const selectorTokens = [`${selector} {`, `${selector}{`];
  const selectorToken = selectorTokens.find((candidateToken) => appStylesRaw.includes(candidateToken));

  if (selectorToken === undefined) {
    throw new Error(`Expected selector ${selector} to exist in the shared app stylesheet.`);
  }

  const ruleBlockStart = appStylesRaw.indexOf(selectorToken) + selectorToken.length;
  const ruleBlockEnd = appStylesRaw.indexOf('}', ruleBlockStart);

  if (ruleBlockEnd < ruleBlockStart) {
    throw new Error(`Expected selector ${selector} to have a closing brace in the shared app stylesheet.`);
  }

  return appStylesRaw
    .slice(ruleBlockStart, ruleBlockEnd)
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(' ');
}
