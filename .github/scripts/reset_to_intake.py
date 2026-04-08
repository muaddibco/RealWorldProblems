from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


REQUIRED_PARENT_LABELS = {"type/problem", "stage/7-validation"}
BLOCKED_PARENT_LABELS = {"agentic-workflows"}
FINAL_PARENT_LABELS = ["type/problem", "stage/0-intake"]

PREFERRED_CUT_MARKER = "<!-- gh-aw-island-start:10-normalize -->"
FALLBACK_CUT_MARKER = "<!-- rw:normalized:start -->"


def env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


GITHUB_TOKEN = env("GH_TOKEN")
API_URL = env("GITHUB_API_URL").rstrip("/")
SERVER_URL = env("GITHUB_SERVER_URL").rstrip("/")
REPOSITORY = env("GITHUB_REPOSITORY")
OWNER, REPO = REPOSITORY.split("/", 1)

RESET_MODE = env("RESET_MODE")
LOWER_ISSUE_ID = max(1, int(float(os.getenv("LOWER_ISSUE_ID", "1"))))
TARGET_ISSUE_ID = int(float(env("TARGET_ISSUE_ID")))

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rw-reset-to-intake-backfill",
}


def log(message: str) -> None:
    print(message, flush=True)


def api_request(method: str, path: str, params: dict[str, Any] | None = None, payload: dict[str, Any] | None = None) -> Any:
    if not path.startswith("/"):
        path = "/" + path

    url = f"{API_URL}/repos/{OWNER}/{REPO}{path}"
    if params:
        query = urllib.parse.urlencode(params, doseq=True)
        url = f"{url}?{query}"

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(url=url, data=data, headers=HEADERS, method=method)

    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: HTTP {error.code}: {body}") from error


def get_issue(issue_number: int) -> dict[str, Any]:
    issue = api_request("GET", f"/issues/{issue_number}")
    if "pull_request" in issue:
        raise RuntimeError(f"#{issue_number} is a pull request, not an issue.")
    return issue


def list_issues_by_labels(labels: list[str], state: str = "open") -> list[dict[str, Any]]:
    page = 1
    results: list[dict[str, Any]] = []

    while True:
        batch = api_request(
            "GET",
            "/issues",
            params={
                "state": state,
                "labels": ",".join(labels),
                "per_page": 100,
                "page": page,
            },
        )

        if not isinstance(batch, list):
            raise RuntimeError("Unexpected response while listing issues.")

        filtered = [item for item in batch if "pull_request" not in item]
        results.extend(filtered)

        if len(batch) < 100:
            break

        page += 1

    return results


def issue_labels(issue: dict[str, Any]) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def qualifies_parent(issue: dict[str, Any]) -> bool:
    labels = issue_labels(issue)
    return REQUIRED_PARENT_LABELS.issubset(labels) and labels.isdisjoint(BLOCKED_PARENT_LABELS) and issue.get("state") == "open"


def qualifies_experiment(issue: dict[str, Any]) -> bool:
    return issue.get("state") == "open" and "type/experiment" in issue_labels(issue)


def cut_parent_body(body: str) -> str | None:
    if body is None:
        body = ""

    preferred_index = body.find(PREFERRED_CUT_MARKER)
    if preferred_index != -1:
        return body[:preferred_index].rstrip()

    fallback_index = body.find(FALLBACK_CUT_MARKER)
    if fallback_index != -1:
        return body[:fallback_index].rstrip()

    return None


def extract_explicit_experiment_ids(parent_body: str) -> set[int]:
    if not parent_body:
        return set()

    matches = re.findall(r"(?mi)^\s*[-*]?\s*Experiment issue:\s*#(\d+)\b", parent_body)
    return {int(match) for match in matches}


def clearly_references_parent(experiment_body: str, parent_number: int, parent_html_url: str) -> bool:
    if not experiment_body:
        return False

    if parent_html_url in experiment_body:
        return True

    repo_issue_path = f"/{REPOSITORY}/issues/{parent_number}"
    if repo_issue_path in experiment_body:
        return True

    repo_short_ref_pattern = rf"(?i)\b{re.escape(REPOSITORY)}#\s*{parent_number}\b"
    if re.search(repo_short_ref_pattern, experiment_body):
        return True

    keyword_before_pattern = rf"(?is)\b(parent|problem)\b.{{0,120}}#\s*{parent_number}\b"
    keyword_after_pattern = rf"(?is)#\s*{parent_number}\b.{{0,120}}\b(parent|problem)\b"
    if re.search(keyword_before_pattern, experiment_body) or re.search(keyword_after_pattern, experiment_body):
        return True

    return False


def close_issue(issue_number: int) -> None:
    try:
        api_request("PATCH", f"/issues/{issue_number}", payload={"state": "closed", "state_reason": "not_planned"})
    except RuntimeError as exc:
        if "state_reason" in str(exc):
            api_request("PATCH", f"/issues/{issue_number}", payload={"state": "closed"})
        else:
            raise


def reset_parent_issue(issue_number: int, new_body: str) -> None:
    api_request(
        "PATCH",
        f"/issues/{issue_number}",
        payload={
            "body": new_body,
            "labels": FINAL_PARENT_LABELS,
        },
    )


def write_summary(lines: list[str]) -> None:
    summary_path = os.getenv("GITHUB_STEP_SUMMARY", "").strip()
    if not summary_path:
        return

    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def select_parent_issues() -> list[dict[str, Any]]:
    if RESET_MODE not in {"single_issue", "range_of_issues"}:
        raise RuntimeError("RESET_MODE must be 'single_issue' or 'range_of_issues'.")

    if RESET_MODE == "single_issue":
        issue = get_issue(TARGET_ISSUE_ID)
        return [issue] if qualifies_parent(issue) else []

    if LOWER_ISSUE_ID > TARGET_ISSUE_ID:
        raise RuntimeError("LOWER_ISSUE_ID must be less than or equal to TARGET_ISSUE_ID.")

    parents = list_issues_by_labels(["type/problem", "stage/7-validation"], state="open")
    selected = [
        issue
        for issue in parents
        if qualifies_parent(issue) and LOWER_ISSUE_ID <= int(issue["number"]) <= TARGET_ISSUE_ID
    ]
    selected.sort(key=lambda issue: int(issue["number"]))
    return selected


def main() -> int:
    log(f"Repository: {REPOSITORY}")
    log(f"Mode: {RESET_MODE}")
    log(f"Lower issue id: {LOWER_ISSUE_ID}")
    log(f"Target issue id: {TARGET_ISSUE_ID}")

    parent_issues = select_parent_issues()
    open_experiments = {
        int(issue["number"]): issue
        for issue in list_issues_by_labels(["type/experiment"], state="open")
        if qualifies_experiment(issue)
    }

    log(f"Selected parent issues: {[issue['number'] for issue in parent_issues]}")
    log(f"Open experiment issues available for matching: {len(open_experiments)}")

    reset_parents: list[int] = []
    closed_experiments: list[int] = []
    skipped_no_marker: list[int] = []

    for parent in parent_issues:
        parent_number = int(parent["number"])
        parent_body = parent.get("body") or ""
        parent_url = parent.get("html_url") or f"{SERVER_URL}/{REPOSITORY}/issues/{parent_number}"

        new_body = cut_parent_body(parent_body)
        if new_body is None:
            log(f"Skipping parent #{parent_number}: no normalize cut marker found.")
            skipped_no_marker.append(parent_number)
            continue

        linked_experiments: set[int] = set()

        explicit_ids = extract_explicit_experiment_ids(parent_body)
        for experiment_number in explicit_ids:
            experiment = open_experiments.get(experiment_number)
            if experiment and qualifies_experiment(experiment):
                linked_experiments.add(experiment_number)

        for experiment_number, experiment in list(open_experiments.items()):
            if experiment_number in linked_experiments:
                continue
            experiment_body = experiment.get("body") or ""
            if clearly_references_parent(experiment_body, parent_number, parent_url):
                linked_experiments.add(experiment_number)

        if linked_experiments:
            log(f"Parent #{parent_number}: closing experiments {sorted(linked_experiments)}")
        else:
            log(f"Parent #{parent_number}: no linked open experiments found")

        for experiment_number in sorted(linked_experiments):
            close_issue(experiment_number)
            closed_experiments.append(experiment_number)
            open_experiments.pop(experiment_number, None)

        reset_parent_issue(parent_number, new_body)
        reset_parents.append(parent_number)
        log(f"Parent #{parent_number}: reset to labels {FINAL_PARENT_LABELS}")

    summary_lines = [
        "## Reset to intake backfill",
        "",
        f"- Repository: `{REPOSITORY}`",
        f"- Mode: `{RESET_MODE}`",
        f"- Lower issue id: `{LOWER_ISSUE_ID}`",
        f"- Target issue id: `{TARGET_ISSUE_ID}`",
        f"- Parents reset: `{len(reset_parents)}`",
        f"- Experiments closed: `{len(closed_experiments)}`",
        f"- Skipped because no marker found: `{len(skipped_no_marker)}`",
        "",
    ]

    if reset_parents:
        summary_lines.append(f"- Reset parent issues: {', '.join(f'#{n}' for n in reset_parents)}")
    if closed_experiments:
        summary_lines.append(f"- Closed experiment issues: {', '.join(f'#{n}' for n in closed_experiments)}")
    if skipped_no_marker:
        summary_lines.append(f"- Skipped parent issues: {', '.join(f'#{n}' for n in skipped_no_marker)}")

    if not reset_parents and not closed_experiments:
        summary_lines.append("- Nothing qualified for reset.")

    write_summary(summary_lines)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise