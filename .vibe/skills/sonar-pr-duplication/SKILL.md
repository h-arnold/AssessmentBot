---
name: sonar-pr-duplication
description: Fetch and expand the latest Sonar PR duplication comment into file-level details.
license: MIT
compatibility: Python 3.12+
user-invocable: true
allowed-tools:
  - bash
  - read_file
  - write_file
---

# Sonar PR Duplication

This skill fetches the latest Sonar PR duplication comment and expands it into file-level details.

## Usage

Invoke this skill to get detailed duplication and quality gate information from SonarQube or SonarCloud.

## Example Workflow

1. **Invoke the Skill**: Use the skill to fetch and expand the Sonar PR duplication comment.
2. **Parse Output**: The skill will return detailed duplication and quality gate information.

## Tools

- `bash`: To execute the Python script.
- `read_file`: To read the script and other necessary files.
- `write_file`: To write the output to a file if needed.

## Configuration

No additional configuration is required. The skill uses the existing Python script and Mistral Vibe tools.
