---
name: Agent Orchestrator
description: Coordinates testing, implementation, review, documentation, and cleanup work against `ACTION_PLAN.md`.
---

# Agent Orchestrator

Use this skill to coordinate delivery against `ACTION_PLAN.md`.

Keep the workflow strict, sequential, and TDD-first.

## Start-up

1. Find `ACTION_PLAN.md` at the repository root.
2. Read it fully and capture:
   - scope
   - assumptions
   - global constraints and quality gates
   - each numbered section, including objective, constraints, acceptance criteria, required test cases, and section checks
3. If `ACTION_PLAN.md` is missing, or the request clearly lacks an up-to-date planning set, delegate planning to `Planner` first.
4. Detect the delegation environment once and reuse it.
5. Keep the active section and current phase reflected in the action plan or task tracker at all times.

When delegating, pass full context every time:

- files read
- constraints
- exact requested outcome
- expected deliverables

Every sub-agent handoff must include a `Files read` section with explicit file paths.

## Mandatory section loop

Process sections one at a time. Do not overlap sections. Do not skip phases.

Before accepting any sub-agent handoff, verify:

- the handoff includes `Files read` with explicit file paths
- every mandatory documentation file required by that sub-agent is listed
- missing mandatory-read evidence is treated as a blocking failure

For each section, run this loop until the section is clean:

### Red

Delegate the section's required test cases to `Testing Specialist`.

Pass:

- section name
- objective
- acceptance criteria
- required test cases
- relevant constraints
- section checks
- applicable testing docs

Expectation:

- tests are added or updated
- the intended failures are present
- the section checks are run

Review the red-phase diff with `Code Reviewer`. If findings are returned, send them back to `Testing Specialist`, re-run checks, and resubmit until clean.

### Green

Delegate the minimal production changes to `Implementation`.

Pass:

- the section tests
- objective
- acceptance criteria
- constraints
- section checks
- relevant module instructions and AGENTS guidance

Expectation:

- code changes stay within scope
- tests pass
- section checks pass

Review the green-phase diff with `Code Reviewer`. If findings are returned, send them back to `Implementation`, fix them, rerun checks, and resubmit until clean.

### Refactor

Only if review requires it, delegate the refactor back to `Implementation`, keep all tests passing, and send the result back through `Code Reviewer` until clean.

## Commit and push

At the end of each completed section:

1. Update `ACTION_PLAN.md` for the finished section.
2. Create a commit for the section changes.
3. Create a separate commit for plan or documentation updates if they are not already included.
4. Push the current branch.

Record:

- commit SHA(s)
- exact commit message(s)
- branch name
- confirmation that `git push` succeeded

Do not start the next section until the current section's code, plan updates, commit artefacts, and push are complete.

## Mandatory de-sloppification pass

After all sections are complete and before any final documentation work, run a compulsory cleanup pass with `De-Sloppification`.

If cleanup work is identified, delegate the minimal fix set to `Implementation`, keep the changes local, and re-run `Code Reviewer` until the cleanup is clean.

Update `ACTION_PLAN.md` with the cleanup outcome before proceeding.

## Final documentation pass

After all sections are complete and the mandatory de-sloppification pass is complete:

1. Gather the changed files and diff against the working branch base.
2. Delegate documentation sync to `Docs`.
3. Review the docs changes.
4. Commit the docs updates.
5. Push the branch again.
