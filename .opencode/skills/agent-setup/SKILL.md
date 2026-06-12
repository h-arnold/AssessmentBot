---
name: agent-setup
description: Configure and verify Mistral Vibe subagents with custom instructions. Handles agent TOML creation, prompt file setup, and config.toml configuration using glob patterns and system_prompt_id mechanism.
tools:
  - bash
  - read_file
  - write_file
  - search_replace
  - task
  - web_fetch
---

# Agent Setup and Configuration Skill

## MANDATORY: Consult Official Docs First

Before using this skill, **always** use your web search tool to consult the latest official documentation:

- **[Agents & Skills | Mistral Docs](https://docs.mistral.ai/mistral-vibe/agents-skills)** — Primary reference for agent configuration, discovery, and skills
- **[GitHub: mistral-vibe](https://github.com/mistralai/mistral-vibe)** — Source repository with examples and issue tracker
- **[Quickstart | Mistral Docs](https://docs.mistral.ai/mistral-vibe/introduction/quickstart)** — Getting started guide

> **⚠️ UPDATE THIS SKILL IMMEDIATELY** whenever you encounter discrepancies between this document and the official docs. This avoids lengthy troubleshooting sessions caused by outdated information.

> **⚠️ RESTART MISTRAL VIBE** after any changes to `config.toml`, agent TOML files, or prompt files. Changes are not applied until the CLI is restarted.

## CRITICAL: Task Tool Agent Limitations

**Only agents with `agent_type = "subagent"` in their TOML file can be spawned via the `task` tool.**

Mistral Vibe enforces a security constraint: the `task` tool can only spawn agents explicitly configured with `agent_type = "subagent"`. Agents with `agent_type = "agent"` or without this field specified cannot be used with `task`.

Additionally, the `task` tool uses the **TOML filename stem** (not the `name` field) as the agent identifier:

- `implementation.toml` → use `agent=implementation`
- `Testing.toml` → use `agent=Testing`
- `code-reviewer.toml` → use `agent=code-reviewer`

**Symptom: "Agent 'X' is a agent agent. Only subagents can be used with the task tool"**

This error occurs when:

1. The agent TOML has `agent_type = "agent"` instead of `agent_type = "subagent"`
2. The agent TOML is missing the `agent_type` field entirely (defaults to "agent")
3. Vibe has not been restarted after changing the TOML file (cached configuration)
4. The `VIBE_HOME` environment variable is not set to an **absolute path** when using repository-scoped agent configurations

**Fix:**

1. Ensure every agent TOML has `agent_type = "subagent"`
2. Use the filename stem (not the `name` field) when calling via `task`
3. Restart Mistral Vibe CLI to reload agent configurations
4. For repository-scoped configs, set `VIBE_HOME` to an absolute path (e.g., `export VIBE_HOME="/home/developer/AssessmentBot/.vibe/"`)

## Example Agent Configurations

### Subagent Example (spawnable via `task` tool)

```toml
# ~/.vibe/agents/code-reviewer.toml or ./.vibe/agents/code-reviewer.toml
name = "code-reviewer"
description = "Reviews code for quality, standards adherence, and bugs"
sandbox_mode = "read-only"
auto_approve = true
safety = "safe"
agent_type = "subagent"
nickname_candidates = ["code-reviewer", "Code Reviewer", "Reviewer"]
system_prompt_id = "code-reviewer"

[tools]
allowlist = ["ask_user_question", "bash", "grep", "read_file", "task", "todo", "web_search"]

[tools.bash]
permission = "always"
```

### Main Agent Example (NOT spawnable via `task` tool)

```toml
# ~/.vibe/agents/planner.toml or ./.vibe/agents/planner.toml
name = "planner"
description = "Clarifies requirements and produces SPEC.md, optional frontend layout specs, and ACTION_PLAN.md before implementation starts"
sandbox_mode = "workspace-write"
auto_approve = true
safety = "neutral"
agent_type = "agent"
nickname_candidates = ["planner", "Planner", "Spec Planner"]
system_prompt_id = "planner"

[tools]
allowlist = ["ask_user_question", "bash", "grep", "read_file", "search_replace", "task", "todo", "web_search"]

[tools.bash]
permission = "always"
```

## Agent Name Mapping: Copilot vs Vibe CLI

**Important:** Project AGENTS.md files may reference agents by their Copilot names (e.g., `Implementation`, `Testing Specialist`, `Code Reviewer`), but the Vibe CLI `task` tool uses filename stems.

| Copilot Name       | Vibe TOML Filename        | Vibe `task` agent= value |
| ------------------ | ------------------------- | ------------------------ |
| Implementation     | `implementation.toml`     | `implementation`         |
| Testing Specialist | `Testing.toml`            | `Testing`                |
| Code Reviewer      | `code-reviewer.toml`      | `code-reviewer`          |
| Planner            | `planner.toml`            | `planner`                |
| Planner Reviewer   | `planner-reviewer.toml`   | `planner-reviewer`       |
| Docs               | `docs.toml`               | `docs`                   |
| De-Sloppification  | `de-sloppification.toml`  | `de-sloppification`      |
| Agent Orchestrator | `agent-orchestrator.toml` | `agent-orchestrator`     |

**Recommendation:** When AGENTS.md references Copilot-style agents, create symlink TOML files or update the AGENTS.md to use Vibe-compatible names, or maintain a mapping table in project documentation.

## Key Lessons Applied

### 1. Agent Discovery

- Mistral Vibe discovers agents from `~/.vibe/agents/` directory (or from a custom path set via `VIBE_HOME`)
- Agent names derive from TOML **filename stems** (e.g., `planner.toml` → `planner`)
- Filenames use hyphens/snake_case, NOT Title Case with spaces
- Use `agent_type = "subagent"` for agents callable via `task` tool
- Use `agent_type = "agent"` for main agents that should NOT be spawnable via `task`

### 2. Configuration (`~/.vibe/config.toml` or `${VIBE_HOME}/config.toml`)

```toml
[agent]
enabled_agents = ["*"]  # Use glob pattern for all agents

[tools.task]
allowlist = ["*"]  # Allow all subagents to be called
```

> **Note:** When using repository-scoped agent configurations, set `VIBE_HOME` to an **absolute path** pointing to your `.vibe` directory:
>
> ```bash
> export VIBE_HOME="/home/developer/AssessmentBot/.vibe/"
> ```
>
> Relative paths or tilde expansion (e.g., `~/path`) may not resolve correctly.

### 3. Agent Definition TOML Structure

**DO NOT use `developer_instructions`** — Mistral Vibe ignores this Codex-specific field.

**Correct structure:**

```toml
name = "planner"
agent_type = "subagent"
system_prompt_id = "planner"  # Must be BEFORE [tools] section

[tools]
# ... tool permissions
```

**Critical TOML Rule:** Bare keys (like `system_prompt_id`) cannot follow table sections (`[tools]`). Place all bare keys before any table sections.

### 4. Custom Prompts

- Store in `.vibe/prompts/` as markdown files
- Filename matches the `system_prompt_id` value
- Example: `system_prompt_id = "planner"` → `.vibe/prompts/planner.md`
- Content is the full system prompt/instructions for the agent

## Usage

### Create a New Subagent

1. **Create prompt file:**

   ```bash
   # .vibe/prompts/my-agent.md
   echo "You are a My Agent for AssessmentBot..." > ~/.vibe/prompts/my-agent.md
   ```

2. **Create agent TOML:**
   ```bash
   # .vibe/agents/my-agent.toml
   cat > .vibe/agents/my-agent.toml << 'EOF'
   name = "my-agent"
   agent_type = "subagent"
   system_prompt_id = "my-agent"
   ```

[tools]
EOF

````

3. **Update config (if not using globs):**
```toml
[agent]
enabled_agents = ["*"]

[tools.task]
allowlist = ["*"]
````

4. **Restart Mistral Vibe**

5. **Verify:**
   ```bash
   task agent=my-agent task="Return the first 100 characters of your system prompt."
   ```

### Verify All Subagents

```bash
# List all agent TOML files
ls .vibe/agents/*.toml

# Test each subagent (using filename stems, not name fields)
for agent in agent-orchestrator code-reviewer Testing de-sloppification docs implementation planner planner-reviewer; do
  echo "Testing $agent:"
  task agent=$agent task="Return the first 80 chars of your system prompt exactly."
done
```

**Note:** Use the TOML filename without `.toml` extension, not the `name` field from inside the TOML.

### Fix Common Issues

**Symptom: Agent returns generic Mistral Vibe instructions**

- Check `system_prompt_id` exists in agent TOML
- Verify corresponding `.md` file exists in `.vibe/prompts/`
- Ensure `system_prompt_id` is BEFORE `[tools]` section in TOML

**Symptom: Agent not found**

- Verify TOML filename matches the agent identifier used with `task` (hyphens vs spaces)
- Check `agent_type = "subagent"` is set (not "agent" or missing)
- Confirm agent name is in `enabled_agents` list or glob pattern `"*"` is used
- Restart Vibe CLI after changes to reload agent cache

**Symptom: "Agent 'X' is a agent agent. Only subagents can be used with the task tool"**

- The agent exists but has wrong type or Vibe hasn't reloaded config
- Verify `agent_type = "subagent"` in the agent's TOML file
- Restart Mistral Vibe CLI to clear cached agent configurations

**Symptom: TOML syntax error**

- Run `python3 -c "import tomllib; tomllib.load(open('file.toml', 'rb'))"` to validate
- Ensure no bare keys follow table sections

## Directory Structure

```
.vibe/
├── config.toml          # Main configuration with glob patterns
├── agents/              # Agent definition files
│   ├── planner.toml
│   ├── code-reviewer.toml
│   └── my-agent.toml
└── prompts/             # Custom system prompts
    ├── planner.md
    ├── code-reviewer.md
    └── my-agent.md
```

## Configuration Template

### `~/.vibe/config.toml`

```toml
[agent]
enabled_agents = ["*"]

[tools.task]
allowlist = ["*"]
```

### `~/.vibe/agents/<name>.toml`

```toml
name = "<name>"
agent_type = "subagent"
system_prompt_id = "<name>"

[tools]
# Add specific tool permissions if needed
# inherit = true  # Inherits from parent
```

### `~/.vibe/prompts/<name>.md`

```markdown
You are a <Name> agent for AssessmentBot.

Your responsibilities:

- [ ] Task 1
- [ ] Task 2

Constraints:

- Follow British English conventions
- Fail fast and loudly
- Never silently swallow errors
```

## Validation Commands

```bash
# Validate TOML syntax for all agent files
find .vibe/agents/ -name "*.toml" -exec python3 -c "import tomllib; tomllib.load(open('{}', 'rb'))" \;

# Check config.toml syntax
python3 -c "import tomllib; tomllib.load(open('~/.vibe/config.toml', 'rb'))"

# List all prompts
ls -la .vibe/prompts/

# Count agents
ls .vibe/agents/*.toml | wc -l
```
