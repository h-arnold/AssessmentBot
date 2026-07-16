import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

describe('backend API WebApp doGet', () => {
  let doGet;

  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.HtmlService = {
      createHtmlOutputFromFile: vi.fn(() => ({ html: true })),
    };

    delete require.cache[require.resolve('../../src/backend/z_Api/WebApp.js')];
    ({ doGet } = require('../../src/backend/z_Api/WebApp.js'));
  });

  afterEach(() => {
    delete globalThis.HtmlService;
  });

  it('renders the React app via HtmlService.createHtmlOutputFromFile', () => {
    const output = doGet();

    expect(globalThis.HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('UI/ReactApp');
    expect(output).toEqual({ html: true });
  });

  it('works when module exports are unavailable in the runtime context', () => {
    const filePath = path.resolve(__dirname, '../../src/backend/z_Api/WebApp.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const context = {
      HtmlService: {
        createHtmlOutputFromFile: vi.fn(() => ({ html: true })),
      },
    };

    vm.runInNewContext(source, context, { filename: filePath });

    expect(context.doGet()).toEqual({ html: true });
    expect(context.HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('UI/ReactApp');
  });
});
