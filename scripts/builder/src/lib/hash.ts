import { createHash } from 'node:crypto';

/**
 * Creates a deterministic SHA-256 checksum for UTF-8 content.
 *
 * @param {string} content - Content to hash.
 * @return {string} Lowercase hexadecimal SHA-256 checksum.
 */
export function checksumUtf8(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

