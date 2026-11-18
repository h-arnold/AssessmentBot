import { Plugin } from '@opencode/plugin';

const TOOL_NAME = 'compact_context';
const IMPLEMENTER_AGENT = 'action-plan-implementer';

const DESCRIPTION = [
  'Compact the current session context to free context-window space.',
  'This compacts the active subagent session only; it does not compact the project plan or ACTION_PLAN.md.',
  'Call it only at a section boundary: once, immediately after the section is committed and pushed, and before starting the next section.',
  'Do not call it during red, green, review or refactor phases.',
  'The request is asynchronous: it returns a short status string, not a summary, and takes effect at the next step boundary.',
].join(' ');

export default Plugin.define({
  id: 'assessmentbot-compact-context',
  async setup(ctx) {
    await ctx.tool.transform((tools) => {
      tools.add({
        name: TOOL_NAME,
        description: DESCRIPTION,
        input: { type: 'object', properties: {}, additionalProperties: false },
        options: { codemode: false },
        execute: async (_input, context) => {
          // The pinned dev types predate `permission.assert`; the current server API provides it.
          const permission = ctx.permission as typeof ctx.permission & {
            assert(input: {
              sessionID: string;
              agent: string;
              source: { type: 'tool'; messageID: string; id: string };
              action: string;
              resources: string[];
              save: string[];
            }): Promise<void>;
          };
          await permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: 'tool', messageID: context.messageID, id: context.id },
            action: TOOL_NAME,
            resources: ['*'],
            save: [],
          });
          await ctx.session.compact({ sessionID: context.sessionID });
          return {
            content: `Context compaction requested for session ${context.sessionID}; it runs at the next step boundary. This affects this session only, not the project plan.`,
          };
        },
      });
    });

    await ctx.session.hook('context', (event) => {
      if (event.agent !== IMPLEMENTER_AGENT) delete event.tools.compact_context;
    });
  },
});
