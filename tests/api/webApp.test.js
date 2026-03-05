import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('backend API WebApp doGet', () => {
  let doGet;
  let evaluate;

  beforeEach(() => {
    vi.clearAllMocks();

    evaluate = vi.fn(() => ({ html: true }));

    globalThis.HtmlService = {
      createTemplateFromFile: vi.fn(() => ({
        evaluate,
      })),
    };

    delete require.cache[require.resolve('../../src/backend/Api/WebApp.js')];
    ({ doGet } = require('../../src/backend/Api/WebApp.js'));
  });

  afterEach(() => {
    delete globalThis.HtmlService;
    delete require.cache[require.resolve('../../src/backend/Api/WebApp.js')];
  });

  it('renders the React app HtmlService template', () => {
    const output = doGet();

    expect(globalThis.HtmlService.createTemplateFromFile).toHaveBeenCalledWith('UI/ReactApp');
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(output).toEqual({ html: true });
  });
});
