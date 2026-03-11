import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

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

    delete require.cache[require.resolve('../../src/backend/z_Api/WebApp.js')];
    ({ doGet } = require('../../src/backend/z_Api/WebApp.js'));
  });

  afterEach(() => {
    delete globalThis.HtmlService;
  });

  it('renders the React app HtmlService template', () => {
    const output = doGet();

    expect(globalThis.HtmlService.createTemplateFromFile).toHaveBeenCalledWith('UI/ReactApp');
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(output).toEqual({ html: true });
  });

  it('works when module exports are unavailable in the runtime context', () => {
    const filePath = path.resolve(__dirname, '../../src/backend/z_Api/WebApp.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const evaluateWithoutModule = vi.fn(() => ({ html: true }));
    const context = {
      HtmlService: {
        createTemplateFromFile: vi.fn(() => ({
          evaluate: evaluateWithoutModule,
        })),
      },
    };

    vm.runInNewContext(source, context, { filename: filePath });

    expect(context.doGet()).toEqual({ html: true });
    expect(context.HtmlService.createTemplateFromFile).toHaveBeenCalledWith('UI/ReactApp');
    expect(evaluateWithoutModule).toHaveBeenCalledTimes(1);
  });
});
