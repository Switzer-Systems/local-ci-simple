#!/usr/bin/env bash
set -euo pipefail

repo="Switzer-Systems/local-ci-simple"
repo_id="1358786256"
branch="main"
owner_login="wswitzer"
group_name="local-ci-simple-canary"
selected_workflow="Switzer-Systems/local-ci-simple/.github/workflows/trusted-local-ci.yml@refs/heads/main"
mode="${1:-full}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'PASS: %s\n' "$*"
}

command -v gh >/dev/null 2>&1 || fail "gh CLI is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"
gh auth status >/dev/null 2>&1 || fail "gh CLI is not authenticated"

actual_id="$(gh api "repos/${repo}" --jq '.id')"
[[ "$actual_id" == "$repo_id" ]] || fail "repository id is ${actual_id}, expected ${repo_id}"
visibility="$(gh api "repos/${repo}" --jq '.visibility')"
[[ "$visibility" == "public" ]] || fail "repository is ${visibility}, expected public"
pass "repository identity and visibility"

protected="$(gh api "repos/${repo}/branches/${branch}" --jq '.protected')"
[[ "$protected" == "true" ]] || fail "${branch} is not protected"
pass "${branch} reports protected=true"

protection_json="$(gh api "repos/${repo}/branches/${branch}/protection")" || fail "cannot read ${branch} classic branch protection"

requires_pr="$(jq -r 'has("required_pull_request_reviews") and (.required_pull_request_reviews != null)' <<<"$protection_json")"
[[ "$requires_pr" == "true" ]] || fail "pull-request review protection is not configured"

enforce_admins="$(jq -r '.enforce_admins.enabled // false' <<<"$protection_json")"
[[ "$enforce_admins" == "true" ]] || fail "administrator enforcement is not enabled"

bypass_count="$(jq '[
  (.required_pull_request_reviews.bypass_pull_request_allowances.users // [])[],
  (.required_pull_request_reviews.bypass_pull_request_allowances.teams // [])[],
  (.required_pull_request_reviews.bypass_pull_request_allowances.apps // [])[]
] | length' <<<"$protection_json")"
[[ "$bypass_count" == "0" ]] || fail "pull-request protection has ${bypass_count} bypass allowance(s); expected zero"

allow_force_pushes="$(jq -r '.allow_force_pushes.enabled // false' <<<"$protection_json")"
[[ "$allow_force_pushes" == "false" ]] || fail "force pushes are allowed"

allow_deletions="$(jq -r '.allow_deletions.enabled // false' <<<"$protection_json")"
[[ "$allow_deletions" == "false" ]] || fail "branch deletion is allowed"

code_owner_reviews="$(jq -r '.required_pull_request_reviews.require_code_owner_reviews // false' <<<"$protection_json")"
[[ "$code_owner_reviews" == "false" ]] || fail "sandbox single-writer contract expects code-owner review disabled until a distinct reviewer exists"

status_contexts="$(jq -r '(.required_status_checks.contexts // []) | join(",")' <<<"$protection_json")"
[[ ",$status_contexts," == *",contract,"* ]] || fail "required status checks do not include contract"

collaborators_json="$(gh api --paginate "repos/${repo}/collaborators?affiliation=all&per_page=100" --slurp)" \
  || fail "cannot enumerate repository collaborators"
owner_merge_capable_count="$(jq -r --arg owner "$owner_login" '[
  .[][] |
  select(.login == $owner) |
  select((.permissions.admin // false) or (.permissions.maintain // false) or (.permissions.push // false))
] | length' <<<"$collaborators_json")"
[[ "$owner_merge_capable_count" == "1" ]] \
  || fail "expected exactly one merge-capable ${owner_login} collaborator entry, found ${owner_merge_capable_count}"

other_merge_capable_count="$(jq -r --arg owner "$owner_login" '[
  .[][] |
  select(.login != $owner) |
  select((.permissions.admin // false) or (.permissions.maintain // false) or (.permissions.push // false))
] | length' <<<"$collaborators_json")"
if [[ "$other_merge_capable_count" != "0" ]]; then
  other_merge_capable_logins="$(jq -r --arg owner "$owner_login" '[
    .[][] |
    select(.login != $owner) |
    select((.permissions.admin // false) or (.permissions.maintain // false) or (.permissions.push // false)) |
    .login
  ] | unique | join(",")' <<<"$collaborators_json")"
  fail "single-writer trust root violated by merge-capable collaborator(s): ${other_merge_capable_logins}"
fi

pass "branch protection and single-writer owner-controlled trust root are exact"

if [[ "$mode" == "--branch-only" ]]; then
  exit 0
fi
[[ "$mode" == "full" ]] || fail "usage: $0 [--branch-only]"

visible_groups_json="$(gh api "orgs/Switzer-Systems/actions/runner-groups?visible_to_repository=local-ci-simple&per_page=100")" \
  || fail "cannot enumerate runner groups visible to this repository; auth needs Self-hosted runners: read/admin access"
visible_group_count="$(jq -r '.total_count' <<<"$visible_groups_json")"
returned_visible_group_count="$(jq -r '.runner_groups | length' <<<"$visible_groups_json")"
[[ "$visible_group_count" == "$returned_visible_group_count" ]] \
  || fail "runner-group visibility result is paginated/truncated (${returned_visible_group_count}/${visible_group_count}); refuse incomplete proof"
[[ "$visible_group_count" == "1" ]] || {
  visible_group_names="$(jq -r '[.runner_groups[].name] | join(",")' <<<"$visible_groups_json")"
  fail "repository can use ${visible_group_count} runner groups (${visible_group_names}); expected only ${group_name}"
}

actual_visible_group_name="$(jq -r '.runner_groups[0].name' <<<"$visible_groups_json")"
[[ "$actual_visible_group_name" == "$group_name" ]] \
  || fail "only visible runner group is ${actual_visible_group_name}, expected ${group_name}"
group_id="$(jq -r '.runner_groups[0].id' <<<"$visible_groups_json")"
[[ -n "$group_id" && "$group_id" != "null" ]] || fail "runner group ${group_name} has no id"

group_json="$(gh api "orgs/Switzer-Systems/actions/runner-groups/${group_id}")"
[[ "$(jq -r '.visibility' <<<"$group_json")" == "selected" ]] || fail "runner group visibility is not selected"
[[ "$(jq -r '.allows_public_repositories' <<<"$group_json")" == "true" ]] || fail "sandbox group does not allow its selected public repository"
[[ "$(jq -r '.restricted_to_workflows' <<<"$group_json")" == "true" ]] || fail "runner group is not restricted to selected workflows"

workflow_count="$(jq '.selected_workflows | length' <<<"$group_json")"
[[ "$workflow_count" == "1" ]] || fail "runner group has ${workflow_count} selected workflows, expected 1"
actual_workflow="$(jq -r '.selected_workflows[0]' <<<"$group_json")"
[[ "$actual_workflow" == "$selected_workflow" ]] || fail "selected workflow differs from expected trusted workflow"

repos_json="$(gh api "orgs/Switzer-Systems/actions/runner-groups/${group_id}/repositories")"
selected_repo_count="$(jq '.total_count' <<<"$repos_json")"
[[ "$selected_repo_count" == "1" ]] || fail "runner group has ${selected_repo_count} selected repositories, expected 1"
selected_repo_id="$(jq -r '.repositories[0].id' <<<"$repos_json")"
[[ "$selected_repo_id" == "$repo_id" ]] || fail "selected repository id is ${selected_repo_id}, expected ${repo_id}"

runners_json="$(gh api "orgs/Switzer-Systems/actions/runner-groups/${group_id}/runners")"
runner_count="$(jq '.total_count' <<<"$runners_json")"
[[ "$runner_count" == "0" ]] || fail "runner group already contains ${runner_count} runner(s); pre-registration state must be zero"

pass "repository can reach only the exact selected-repo + selected-workflow group, which contains zero runners"
printf 'READY: repository and runner-group preconditions are satisfied for an explicitly approved disposable runner registration.\n'
