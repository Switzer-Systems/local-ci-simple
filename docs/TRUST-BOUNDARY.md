# Trust boundary

## Decision

This sandbox tests a narrow GitHub-native scheduler boundary under an explicit **single-writer owner-controlled trust root**:

```text
protected main
  -> only merge-capable collaborator: @wswitzer
  -> organization runner group restricted to this repository
  -> selected workflow: .github/workflows/trusted-local-ci.yml@refs/heads/main
  -> disposable credential-free runner
```

The selected-workflow branch ref and target revision are different controls. The runner-group policy controls **which workflow may acquire the runner**. The trusted workflow separately fails closed unless the operator-supplied expected SHA equals the workflow run's exact `github.sha` on `refs/heads/main` and the workflow's exact ref/SHA match that run.

Runner labels are routing metadata only.

This sandbox does **not** claim two-person or CODEOWNER approval enforcement. The reduced bootstrap claim is valid only while privileged live readback proves `@wswitzer` is the only merge-capable collaborator and branch-protection bypass allowances are empty. The future Pure Linguistics cutover must add a distinct eligible reviewer/team and enforce CODEOWNER approval before treating reviewer governance as proven.

## Why a public sandbox

The production Pure Linguistics repository is private and cannot exercise the intended protected-private-`main` control until the organization plan supports it. This repository is public so the branch-protection portion can be proven without waiting for that upgrade.

A public repository is also a more hostile environment for a self-hosted runner. Therefore any live runner used here must be a **disposable canary**, not the future Pure Linguistics r1/r2 runner. It must contain no reusable secrets or credentials, no client data, no Azure/database access, and no host mounts.

## Trusted workflow contract

`.github/workflows/trusted-local-ci.yml` must remain the exact audited fixture enforced by `tests/trust-contract.test.mjs`:

- `workflow_dispatch` only;
- exactly the two required operator inputs;
- `permissions: {}`;
- exactly one `authorize` job;
- exact repository `Switzer-Systems/local-ci-simple`;
- exact ref `refs/heads/main`;
- exact workflow ref `Switzer-Systems/local-ci-simple/.github/workflows/trusted-local-ci.yml@refs/heads/main`;
- exact workflow SHA equal to `github.sha`;
- exact actor `wswitzer` and actor ID `112133527`;
- exact triggering actor `wswitzer`;
- exact confirmation phrase;
- exact expected SHA equal to `github.sha`;
- selected group `local-ci-simple-canary`;
- selected labels `self-hosted`, `Linux`, `ARM64`, `local-ci-simple-canary`;
- exactly one metadata-printing shell step;
- no additional `run` or `uses` surface;
- no `pull_request_target`;
- no checkout;
- no third-party/repository actions;
- no OIDC;
- no secret references;
- no target/application code execution.

The shell step only prints GitHub/runner metadata needed to prove acquisition. It is not an authorization boundary; server-side branch protection and runner-group selected-workflow enforcement are.

## Deterministic hosted contract gate

The required hosted `contract` job is the repository's only merge status gate. It must remain independent of the self-hosted runner and cover:

- focused Node contract tests;
- `git diff --check` over the PR/push range;
- `bash -n` for the preflight;
- ShellCheck `v0.11.0`, downloaded from the official release and verified by pinned SHA-256;
- actionlint `v1.7.12`, downloaded from the official release and verified by pinned SHA-256;
- zizmor `v1.29.0` in its official container image pinned to digest `sha256:863026d54f91271b10b60b67ad8054cb37120167e162482597db102b3026a284`, run with `--offline`, Docker networking disabled, and the repository mounted read-only.

The zizmor container receives no GitHub token or other credentials. The hosted gate may inspect repository code. It must not be confused with the credential-free trusted self-hosted acquisition canary.

## Negative workflow

`.github/workflows/unauthorized-local-ci-probe.yml` deliberately targets the same group and labels. When the runner group is correctly restricted to the trusted workflow, this workflow must remain queued/unassigned and must never execute its marker step.

Do not weaken the runner-group restriction merely to make the negative workflow run. A queued/unassigned job with `runner_id=0` and zero steps is expected negative evidence.

## Protected-main requirements

Before any disposable runner registration, live repository settings must prove all of the following:

1. `main` is protected using the sandbox's approved classic branch-protection contract.
2. Changes to `main` require a pull request.
3. Administrator enforcement is enabled and pull-request bypass allowances are exactly empty.
4. Force pushes and branch deletion are disabled.
5. The required `contract` status check is preserved.
6. `@wswitzer` is the only merge-capable collaborator returned by GitHub after accounting for direct, team, organization-default, and organization-owner access.
7. CODEOWNERS remains metadata only in this bootstrap sandbox; no CODEOWNER-enforcement claim is made.

### Single-writer owner-controlled trust root

GitHub does not allow a pull-request author to approve their own PR, and `@wswitzer` is currently both the PR author and sole configured code owner. Instead of pretending CODEOWNER enforcement exists, this sandbox deliberately narrows its governance claim.

The checked-in preflight must fail closed unless `@wswitzer` is the only collaborator with push, maintain, or admin capability and there are zero PR-bypass allowances. If any other merge-capable principal appears, the sandbox trust root is invalid and runner commissioning is blocked.

This reduced claim proves the GitHub scheduler boundary only under a single trusted owner. It does not prove multi-party review governance. Pure Linguistics must resolve that gap with a distinct eligible reviewer/team and required CODEOWNER approval before persistent runner commissioning.

## Expected runner-group contract

For this public sandbox only:

```json
{
  "name": "local-ci-simple-canary",
  "visibility": "selected",
  "selected_repository_ids": [1358786256],
  "allows_public_repositories": true,
  "restricted_to_workflows": true,
  "selected_workflows": [
    "Switzer-Systems/local-ci-simple/.github/workflows/trusted-local-ci.yml@refs/heads/main"
  ]
}
```

Because the repository is public, `allows_public_repositories` must be true for this **dedicated sandbox group only**. Never reuse the Pure Linguistics runner group or a persistent trusted runner for this experiment.

The preflight must query GitHub's repository-visible runner-group view and require `local-ci-simple-canary` to be the **only runner group visible to this public repository**. This closes the possibility that a broader or inherited group could expose some other self-hosted runner surface.

## Fail-closed conditions

Do not register the disposable runner if any of these are false or unknown:

- repository ID is exactly `1358786256`;
- `main` protection satisfies the approved sandbox configuration with zero bypass allowances;
- `@wswitzer` is the only merge-capable collaborator;
- `local-ci-simple-canary` is the only runner group GitHub reports as usable by this repository;
- runner group visibility is `selected`;
- selected repository set is exactly this repository;
- public access is enabled only because this dedicated group targets this public sandbox;
- workflow restriction is enabled;
- selected workflow set is exactly the trusted `@refs/heads/main` workflow;
- group contains zero runners before commissioning;
- the candidate runner has no reusable credentials, secrets, client data, host mounts, Azure/database access, or prior worktree state.

## What this can prove before Team

A successful canary can prove that, under the explicitly reduced single-writer owner-controlled trust root, GitHub's selected-workflow scheduler lets the protected-main trusted workflow acquire a runner while an unauthorized workflow targeting the same group/labels cannot.

It cannot prove two-person/CODEOWNER governance, and it cannot prove that Pure Linguistics private `main` protection is actually enforced. After Team is enabled, PL still needs live readback of its private branch/ruleset protection, enforced reviewer governance, and its own runner-group configuration before any persistent PL runner assignment.
