---
name: loc-counter
description: Count lines of code with `scc` and compare baselines to measure reduction during refactors and deduplication work.
---

# LOC Counter

Use this skill when you want a fast, deterministic LOC baseline or before-and-after comparison
while simplifying code.

## Purpose

- count lines of code for a file or directory
- compare two paths or git states to measure reduction
- establish a baseline for later comparison
- check whether a change actually reduced LOC

## Prerequisite

Install `scc` first if it is not already available.

## Common commands

Count a path:

```bash
scc src/backend
```

Compare two paths:

```bash
scc src/backend src/backend-refactored
```

Compare git revisions:

```bash
scc HEAD~1 HEAD --git
```

Create a baseline:

```bash
scc src --name my-refactor
```

Check reduction against a named baseline:

```bash
scc src/backend --name dedup-task-001
```

## Output to inspect

- total lines, code, comments, and blanks
- per-language breakdown
- delta between before and after runs
- whether the comparison shows reduction

## Best fit

Use this skill when the task is about deduplication, simplification, or proving that a refactor
reduced code volume without changing behaviour.
