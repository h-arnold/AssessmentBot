---
name: sonar-pr-duplication
description: Inspect the latest SonarQube or SonarCloud pull request comment, extract the linked Sonar project and PR context, and retrieve duplication details, quality gate status, coverage metrics, and open issue summaries. Use when a user asks about SonarQube duplication comments, quality gate failures, coverage on a PR, or the latest Sonar report for the current branch.
---

# Sonar PR Duplication

Use this skill when the task is about the SonarQube or SonarCloud pull request report, especially
duplication, quality gate status, coverage, or open Sonar issues on the PR.

Prefer the bundled script instead of manually clicking through GitHub and SonarCloud. The script:

1. resolves the current GitHub repo and PR when not provided
2. fetches the latest Sonar bot PR comment
3. extracts the `component_measures` duplication link from the comment
4. calls SonarCloud's public Web API for:
   - per-file duplication metrics
   - quality gate status and failed conditions
   - coverage metrics
   - open issue summaries
5. calls the Sonar duplication endpoint for flagged files to show matching files and line ranges

## Quick start

Current repo and current branch PR:

```bash
python3 ~/.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py
```

Specific PR:

```bash
python3 ~/.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py --repo h-arnold/AssessmentBot --pr 213
```

Show everything including files under the default gate threshold:

```bash
python3 ~/.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py --threshold 0
```

Machine-readable output:

```bash
python3 ~/.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py --json
```

## Notes

- Default threshold is `3.0`, matching the common Sonar "Duplication on New Code" gate.
- The script expects `gh` authentication to be available for GitHub PR comment lookup.
- SonarCloud data is fetched from the public Web API exposed by the duplication link in the bot
  comment. The key endpoints are:
  - `api/measures/component_tree`
  - `api/duplications/show`
  - `api/qualitygates/project_status`
  - `api/measures/component`
  - `api/issues/search`

## Output expectations

Summarise:

- the latest Sonar comment URL
- the Sonar duplication link
- the quality gate status and any failing conditions
- coverage metrics when present
- the current open Sonar issues on the PR
- the files above threshold sorted by duplication density
- the duplicated block pairings and line ranges for those files

If no Sonar duplication comment is found, say that clearly and stop rather than guessing.
