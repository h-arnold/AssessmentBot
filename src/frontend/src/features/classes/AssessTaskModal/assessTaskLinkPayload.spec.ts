import { describe, expect, it } from 'vitest';
import {
  buildDeduplicatedAlternateTitles,
  buildDeduplicatedAlternateTopics,
} from './assessTaskLinkPayload';

describe('assessment link alternate metadata payload construction', () => {
  it('trims a non-empty alternate title before adding it', () => {
    expect(buildDeduplicatedAlternateTitles(['Existing'], '  New title  ')).toEqual([
      'Existing',
      'New title',
    ]);
  });

  it.each(['', '   ', '\t\n'])(
    'rejects a blank alternate title before payload construction',
    (title) => {
      expect(buildDeduplicatedAlternateTitles(['Existing'], title)).toEqual(['Existing']);
    }
  );

  it('trims a non-empty alternate topic before adding it', () => {
    expect(buildDeduplicatedAlternateTopics(['Existing'], '  New topic  ')).toEqual([
      'Existing',
      'New topic',
    ]);
  });

  it.each(['', '   ', '\t\n'])(
    'rejects a blank alternate topic before payload construction',
    (topic) => {
      expect(buildDeduplicatedAlternateTopics(['Existing'], topic)).toEqual(['Existing']);
    }
  );
});
