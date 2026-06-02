#!/usr/bin/env python3
"""Fetch the latest Sonar PR comment and expand it into duplication and gate details."""

from __future__ import annotations

import argparse
import json
import re
import socket
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import parse_qs, quote, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


DUPLICATION_URL_RE = re.compile(r"https://sonarcloud\.io/component_measures\?[^\s)]+")
NETWORK_TIMEOUT_SECONDS = 15


class ScriptError(RuntimeError):
    """Raised when the script cannot complete the requested lookup."""


@dataclass
class SonarComment:
    """Latest Sonar duplication comment metadata."""

    author: str
    body: str
    created_at: str
    url: str


def is_sonar_login(login: str) -> bool:
    """Return true when the login belongs to a Sonar bot identity."""

    normalised = login.lower()
    return normalised in {
        "sonarqubecloud",
        "sonarqubecloud[bot]",
        "sonarcloud",
        "sonarcloud[bot]",
    }


def run(command: list[str]) -> str:
    """Run a command and return stdout, or raise a readable error."""

    try:
        completed = subprocess.run(
            command,
            check=True,
            text=True,
            capture_output=True,
        )
    except FileNotFoundError as error:
        raise ScriptError(f"Command not found: {command[0]}") from error
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.strip()
        raise ScriptError(stderr or f"Command failed: {' '.join(command)}") from error
    return completed.stdout.strip()


def github_graphql(owner: str, name: str, number: int, before: str | None = None) -> dict[str, Any]:
    """Fetch a page of PR issue comments through GitHub GraphQL."""

    query = """
    query($owner: String!, $name: String!, $number: Int!, $before: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          comments(last: 100, before: $before) {
            nodes {
              author {
                login
              }
              body
              createdAt
              url
            }
            pageInfo {
              hasPreviousPage
              startCursor
            }
          }
        }
      }
    }
    """

    command = [
        "gh",
        "api",
        "graphql",
        "-f",
        f"query={query}",
        "-F",
        f"owner={owner}",
        "-F",
        f"name={name}",
        "-F",
        f"number={number}",
    ]

    if before is not None:
        command.extend(["-F", f"before={before}"])

    return json.loads(run(command))


def resolve_repo(explicit_repo: str | None) -> str:
    """Resolve owner/name for the current repo if not provided."""

    if explicit_repo:
        return explicit_repo
    return run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])


def resolve_pr(explicit_pr: int | None) -> int:
    """Resolve current PR number if not provided."""

    if explicit_pr is not None:
        return explicit_pr
    return int(run(["gh", "pr", "view", "--json", "number", "--jq", ".number"]))


def find_latest_sonar_comment(owner: str, name: str, number: int) -> SonarComment:
    """Walk backwards through PR comments until a Sonar comment is found."""

    before: str | None = None

    while True:
        payload = github_graphql(owner, name, number, before)
        connection = payload["data"]["repository"]["pullRequest"]["comments"]
        nodes = connection["nodes"]

        sonar_nodes = [
            node
            for node in nodes
            if node["author"] is not None
            and is_sonar_login(node["author"]["login"])
        ]
        if sonar_nodes:
            latest = max(sonar_nodes, key=lambda node: node["createdAt"])
            return SonarComment(
                author=latest["author"]["login"],
                body=latest["body"],
                created_at=latest["createdAt"],
                url=latest["url"],
            )

        if not connection["pageInfo"]["hasPreviousPage"]:
            break
        before = connection["pageInfo"]["startCursor"]

    raise ScriptError(f"No Sonar comment found on PR #{number}.")


def extract_duplication_url(comment: SonarComment) -> str:
    """Extract the Sonar duplication detail link from the bot comment."""

    match = DUPLICATION_URL_RE.search(comment.body)
    if match is None:
        raise ScriptError("Found a Sonar comment, but could not extract the duplication link.")
    return match.group(0)


def fetch_quality_gate(base_url: str, project_key: str, pull_request: str) -> dict[str, Any]:
    """Fetch Sonar quality gate status for the PR."""

    url = (
        f"{base_url}/api/qualitygates/project_status"
        f"?projectKey={quote(project_key)}"
        f"&pullRequest={quote(pull_request)}"
    )
    payload = fetch_json(url)
    return payload.get("projectStatus", {})


def get_component_metric(
    component_payload: dict[str, Any], metric_name: str, use_period: bool = False
) -> float | None:
    """Return the numeric value for a component metric."""

    component = component_payload.get("component", {})
    for measure in component.get("measures", []):
        if measure["metric"] != metric_name:
            continue
        if use_period:
            periods = measure.get("periods", [])
            if not periods:
                return None
            value = periods[0].get("value")
            return float(value) if value is not None else None
        value = measure.get("value")
        return float(value) if value is not None else None
    return None


def fetch_coverage(base_url: str, project_key: str, pull_request: str) -> dict[str, float | None]:
    """Fetch coverage metrics for the PR."""

    url = (
        f"{base_url}/api/measures/component"
        f"?component={quote(project_key)}"
        f"&pullRequest={quote(pull_request)}"
        "&metricKeys=new_coverage,coverage,new_lines_to_cover,new_uncovered_lines"
    )
    payload = fetch_json(url)
    return {
        "new_coverage": get_component_metric(payload, "new_coverage", use_period=True),
        "coverage": get_component_metric(payload, "coverage"),
        "new_lines_to_cover": get_component_metric(payload, "new_lines_to_cover", use_period=True),
        "new_uncovered_lines": get_component_metric(payload, "new_uncovered_lines", use_period=True),
    }


def fetch_open_issues(
    base_url: str, project_key: str, pull_request: str, page_size: int = 10
) -> dict[str, Any]:
    """Fetch open Sonar issues for the PR."""

    url = (
        f"{base_url}/api/issues/search"
        f"?componentKeys={quote(project_key)}"
        f"&pullRequest={quote(pull_request)}"
        "&resolved=false"
        f"&ps={page_size}"
    )
    payload = fetch_json(url)
    issues = [
        {
            "key": issue["key"],
            "rule": issue["rule"],
            "severity": issue["severity"],
            "type": issue["type"],
            "message": issue["message"],
            "component": issue["component"],
            "line": issue.get("line"),
        }
        for issue in payload.get("issues", [])
    ]
    return {
        "total": payload.get("total", 0),
        "issues": issues,
    }


def fetch_json(url: str) -> dict[str, Any]:
    """Fetch and decode JSON from a URL."""

    timeout_message = f"Timed out after {NETWORK_TIMEOUT_SECONDS}s fetching Sonar API JSON from {url}"

    try:
        with urlopen(url, timeout=NETWORK_TIMEOUT_SECONDS) as response:  # noqa: S310 - public SonarCloud API URL from bot comment
            return json.load(response)
    except (TimeoutError, socket.timeout) as error:
        raise ScriptError(timeout_message) from error
    except HTTPError as error:
        raise ScriptError(
            f"Sonar API request failed for {url}: HTTP {error.code} {error.reason}"
        ) from error
    except URLError as error:
        if isinstance(error.reason, (TimeoutError, socket.timeout)):
            raise ScriptError(timeout_message) from error
        raise ScriptError(f"Failed to fetch Sonar API JSON from {url}: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise ScriptError(f"Failed to decode Sonar API JSON from {url}: {error}") from error


def get_period_metric(component: dict[str, Any], metric_name: str) -> float:
    """Return the numeric value for a period-based metric."""

    for measure in component.get("measures", []):
        if measure["metric"] != metric_name:
            continue
        periods = measure.get("periods", [])
        if not periods:
            return 0.0
        value = periods[0].get("value")
        return float(value) if value is not None else 0.0
    return 0.0


def fetch_duplication_files(base_url: str, project_key: str, pull_request: str) -> list[dict[str, Any]]:
    """Fetch file-level duplication metrics for the Sonar PR analysis."""

    url = (
        f"{base_url}/api/measures/component_tree"
        f"?component={quote(project_key)}"
        "&metricKeys=new_duplicated_lines,new_duplicated_blocks,new_duplicated_lines_density"
        f"&pullRequest={quote(pull_request)}"
        "&qualifiers=FIL"
        "&ps=500"
    )
    payload = fetch_json(url)
    files = []
    for component in payload.get("components", []):
        files.append(
            {
                "key": component["key"],
                "path": component["path"],
                "density": get_period_metric(component, "new_duplicated_lines_density"),
                "lines": int(get_period_metric(component, "new_duplicated_lines")),
                "blocks": int(get_period_metric(component, "new_duplicated_blocks")),
            }
        )
    return sorted(files, key=lambda item: (-item["density"], -item["lines"], -item["blocks"], item["path"]))


def fetch_duplication_details(base_url: str, file_key: str, pull_request: str) -> list[list[dict[str, Any]]]:
    """Fetch duplicated block mappings for one file."""

    url = (
        f"{base_url}/api/duplications/show"
        f"?key={quote(file_key)}"
        f"&pullRequest={quote(pull_request)}"
    )
    payload = fetch_json(url)
    file_map = payload.get("files", {})
    groups: list[list[dict[str, Any]]] = []

    for duplication in payload.get("duplications", []):
        group = []
        for block in duplication.get("blocks", []):
            file_info = file_map[block["_ref"]]
            start_line = int(block["from"])
            size = int(block["size"])
            end_line = start_line + size - 1
            group.append(
                {
                    "path": file_info["name"],
                    "start_line": start_line,
                    "end_line": end_line,
                    "size": size,
                }
            )
        groups.append(group)
    return groups


def parse_gate_summary(comment_body: str) -> dict[str, str] | None:
    """Pull the gate summary out of the bot comment when present."""

    match = re.search(
        r"\[(?P<actual>\d+(?:\.\d+)?)% Duplication on New Code\].*?required ≤ (?P<required>\d+(?:\.\d+)?)%",
        comment_body,
        flags=re.DOTALL,
    )
    if match is None:
        return None
    return {"actual": match.group("actual"), "required": match.group("required")}


def build_report(repo: str, pr_number: int, threshold: float, include_all: bool) -> dict[str, Any]:
    """Build the full duplication report."""

    owner, name = repo.split("/", 1)
    comment = find_latest_sonar_comment(owner, name, pr_number)
    duplication_url = extract_duplication_url(comment)
    parsed_url = urlparse(duplication_url)
    params = parse_qs(parsed_url.query)
    project_key = params["id"][0]
    sonar_pr = params.get("pullRequest", [str(pr_number)])[0]
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

    files = fetch_duplication_files(base_url, project_key, sonar_pr)
    selected_files = files if include_all else [item for item in files if item["density"] >= threshold]
    quality_gate = fetch_quality_gate(base_url, project_key, sonar_pr)
    coverage = fetch_coverage(base_url, project_key, sonar_pr)
    open_issues = fetch_open_issues(base_url, project_key, sonar_pr)

    for file_entry in selected_files:
        if file_entry["blocks"] <= 0:
            file_entry["duplication_groups"] = []
            continue
        file_entry["duplication_groups"] = fetch_duplication_details(base_url, file_entry["key"], sonar_pr)

    gate_summary = parse_gate_summary(comment.body)

    return {
        "repo": repo,
        "pr_number": pr_number,
        "comment": {
            "author": comment.author,
            "url": comment.url,
            "created_at": comment.created_at,
        },
        "duplication_url": duplication_url,
        "sonar_project_key": project_key,
        "sonar_pull_request": sonar_pr,
        "gate_summary": gate_summary,
        "quality_gate": quality_gate,
        "coverage": coverage,
        "open_issues": open_issues,
        "threshold": threshold,
        "files": selected_files,
    }


def format_report(report: dict[str, Any]) -> str:
    """Render a human-readable report."""

    lines = [
        "Latest Sonar duplication comment",
        f"Repo: {report['repo']}",
        f"PR: #{report['pr_number']}",
        f"Comment: {report['comment']['url']}",
        f"Created: {report['comment']['created_at']}",
        f"Duplication link: {report['duplication_url']}",
        f"Sonar project: {report['sonar_project_key']}",
        f"Sonar pull request: {report['sonar_pull_request']}",
    ]

    gate_summary = report.get("gate_summary")
    if gate_summary is not None:
        lines.append(
            f"Gate: {gate_summary['actual']}% Duplication on New Code (required <= {gate_summary['required']}%)"
        )
    quality_gate = report.get("quality_gate", {})
    if quality_gate:
        lines.append(f"Quality gate status: {quality_gate.get('status', 'UNKNOWN')}")
        failing_conditions = [
            condition
            for condition in quality_gate.get("conditions", [])
            if condition.get("status") == "ERROR"
        ]
        for condition in failing_conditions:
            actual_value = condition.get("actualValue", "?")
            threshold = condition.get("errorThreshold", "?")
            lines.append(
                f"- quality gate failure: {condition['metricKey']} actual={actual_value} threshold={threshold}"
            )

    coverage = report.get("coverage", {})
    if coverage:
        lines.append(
            "Coverage: "
            f"new_coverage={coverage.get('new_coverage')} "
            f"coverage={coverage.get('coverage')} "
            f"new_lines_to_cover={coverage.get('new_lines_to_cover')} "
            f"new_uncovered_lines={coverage.get('new_uncovered_lines')}"
        )

    open_issues = report.get("open_issues", {})
    if open_issues:
        lines.append(f"Open Sonar issues: {open_issues.get('total', 0)}")
        for issue in open_issues.get("issues", []):
            location = f"{issue['component']}:{issue['line']}" if issue.get("line") else issue["component"]
            lines.append(
                f"- issue {issue['type']}/{issue['severity']}: {issue['message']} ({location})"
            )

    files = report["files"]
    lines.append(f"Files meeting threshold: {len(files)}")

    for file_entry in files:
        lines.append(
            f"- {file_entry['path']}: {file_entry['density']:.2f}% new duplicated lines, "
            f"{file_entry['lines']} duplicated lines, {file_entry['blocks']} blocks"
        )
        for index, group in enumerate(file_entry.get("duplication_groups", []), start=1):
            fragments = [
                f"{block['path']}:{block['start_line']}-{block['end_line']}"
                for block in group
            ]
            lines.append(f"  group {index}: {' <-> '.join(fragments)}")

    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""

    parser = argparse.ArgumentParser(
        description="Expand the latest Sonar PR duplication comment into file-level details."
    )
    parser.add_argument("--repo", help="GitHub repo in owner/name form. Defaults to the current checkout.")
    parser.add_argument("--pr", type=int, help="Pull request number. Defaults to the current branch PR.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=3.0,
        help="Minimum new duplication density percentage to include. Default: 3.0",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Include all files, even those below threshold.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON instead of plain text.",
    )
    return parser.parse_args()


def main() -> int:
    """CLI entry point."""

    args = parse_args()

    try:
        repo = resolve_repo(args.repo)
        pr_number = resolve_pr(args.pr)
        report = build_report(repo, pr_number, args.threshold, args.all)
    except ScriptError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(format_report(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
