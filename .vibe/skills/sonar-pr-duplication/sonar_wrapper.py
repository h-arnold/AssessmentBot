#!/usr/bin/env python3
"""Wrapper script to adapt the SonarQube skill for Mistral Vibe."""

import subprocess
import sys
import json

def run_sonar_script(args):
    """Run the SonarQube script with the given arguments."""
    command = [
        "python3",
        "/home/developer/.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py",
    ] + args
    try:
        result = subprocess.run(command, check=True, text=True, capture_output=True)
        return result.stdout
    except subprocess.CalledProcessError as error:
        print(f"Error: {error.stderr}", file=sys.stderr)
        return None

def main():
    """Main function to handle the skill invocation."""
    args = sys.argv[1:]
    output = run_sonar_script(args)
    if output:
        print(output)

if __name__ == "__main__":
    main()