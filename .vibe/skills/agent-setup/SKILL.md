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

## IMPORTANT: Consult Official Docs First

**The Mistral Vibe agent and skill system is actively evolving.** Before using this skill, always consult the latest official documentation:

- **[Agents & Skills | Mistral Docs](https://docs.mistral.ai/mistral-vibe/agents-skills)** — Primary reference for agent configuration, discovery, and skills
- **[GitHub: mistral-vibe](https://github.com/mistralai/mistral-vibe)** — Source repository with examples and issue tracker
- **[Quickstart | Mistral Docs](https://docs.mistral.ai/mistral-vibe/introduction/quickstart)** — Getting started guide

> **⚠️ UPDATE THIS SKILL IMMEDIATELY** whenever you encounter discrepancies between this document and the official docs. This avoids lengthy troubleshooting sessions caused by outdated information.

> **⚠️ RESTART MISTRAL VIBE** after any changes to `config.toml`, agent TOML files, or prompt files. Changes are not applied until the CLI is restarted.

This skill automates the setup, configuration, and verification of Mistral Vibe subagents with custom system instructions.

## Key Lessons Applied

### 1. Agent Discovery

- Mistral Vibe discovers agents from `~/.vibe/agents/` directory
- Agent names derive from TOML **filename stems** (e.g., `planner.toml` → `planner`)
- Filenames use hyphens/snake_case, NOT Title Case with spaces
- Use `type = "subagent"` for agents callable via `task` tool

### 2. Configuration (`~/.vibe/config.toml`)

```toml
[agent]
enabled_agents = ["*"]  # Use glob pattern for all agents

[tools.task]
allowlist = ["*"]  # Allow all subagents to be called
```

### 3. Agent Definition TOML Structure

**DO NOT use `developer_instructions`** — Mistral Vibe ignores this Codex-specific field.

**Correct structure:**

```toml
name = "planner"
type = "subagent"
system_prompt_id = "planner"  # Must be BEFORE [tools] section

[tools]
# ... tool permissions
```

**Critical TOML Rule:** Bare keys (like `system_prompt_id`) cannot follow table sections (`[tools]`). Place all bare keys before any table sections.

### 4. Custom Prompts

- Store in `~/.vibe/prompts/` as markdown files
- Filename matches the `system_prompt_id` value
- Example: `system_prompt_id = "planner"` → `~/.vibe/prompts/planner.md`
- Content is the full system prompt/instructions for the agent

## Usage

### Create a New Subagent

1. **Create prompt file:**

   ```bash
   # ~/.vibe/prompts/my-agent.md
   echo "You are a My Agent for AssessmentBot..." > ~/.vibe/prompts/my-agent.md
   ```

2. **Create agent TOML:**
   ```bash
   # ~/.vibe/agents/my-agent.toml
   cat > ~/.vibe/agents/my-agent.toml << 'EOF'
   name = "my-agent"
   type = "subagent"
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
ls ~/.vibe/agents/*.toml

# Test each subagent
for agent in planner code-reviewer Testing docs implementation de-sloppification; do
  echo "Testing $agent:"
  task agent=$agent task="Return the first 80 chars of your system prompt exactly."
done
```

### Fix Common Issues

**Symptom: Agent returns generic Mistral Vibe instructions**

- Check `system_prompt_id` exists in agent TOML
- Verify corresponding `.md` file exists in `~/.vibe/prompts/`
- Ensure `system_prompt_id` is BEFORE `[tools]` section in TOML

**Symptom: Agent not found**

- Verify TOML filename matches agent name (hyphens vs spaces)
- Check `type = "subagent"` is set
- Confirm agent name is in `enabled_agents` list or glob pattern is used

**Symptom: TOML syntax error**

- Run `python3 -c "import tomllib; tomllib.load(open('file.toml', 'rb'))"` to validate
- Ensure no bare keys follow table sections

## Directory Structure

```
~/.vibe/
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
type = "subagent"
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
find ~/.vibe/agents/ -name "*.toml" -exec python3 -c "import tomllib; tomllib.load(open('{}', 'rb'))" \;

# Check config.toml syntax
python3 -c "import tomllib; tomllib.load(open('~/.vibe/config.toml', 'rb'))"

# List all prompts
ls -la ~/.vibe/prompts/

# Count agents
ls ~/.vibe/agents/*.toml | wc -l
```
