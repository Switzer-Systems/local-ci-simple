# Trust boundary

## Decision

This sandbox tests the narrow GitHub-native boundary supported by the Pure Linguistics Issue #244 scheduler A/B evidence:

```text
protected main
  -> organization runner group restricted to this repository
  -> selected workflow: .github/workflows/trusted-local-ci.yml@refs/heads/main
  -> disposable credential-free runner
```

The selected-workflow branch ref and target revision are different controls. The runner-group policy controls **which workflow may acquire the runner**. The trusted workflow separately fails closed unless the operator-supplied expected SHA equals the workflow run's exact `github.sha` on `refs/heads/main` and the workflow's exact ref/SHA match that run.

Runner labels are routing metadata only.

## Why a public sandbox

The production Pure Linguistics repository is private and cannot exercise the intended protected-private-`main` control until the organization plan supports it. This repository is public so the branch-protection portion can be proven without waiting for that upgrade.

A public repository is also a more hostile environment for a self-hosted runner. Therefore any live runner used here must be a **disposable canary**, not the future Pure Linguistics r1/r2 runner. It must contain no reusable secrets or credentials, no client data, no Azure/database access, and no host mounts.

## Trusted workflow contract

`.github/workflows/trusted-local-ci.yml` must remain:

- `workflow_dispatch` only;
- `permissions: {}`;
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
- zizmor `v1.29.0` through the official zizmor action pinned to an exact commit SHA, with online audits and token use disabled.

The hosted gate may inspect repository code. It must not be confused with the credential-free trusted self-hosted acquisition canary.

## Negative workflow

`.github/workflows/unauthorized-local-ci-probe.yml` deliberately targets the same group and labels. When the runner group is correctly restricted to the trusted workflow, this workflow must remain queued/unassigned and must never execute its marker step.

Do not weaken the runner-group restriction merely to make the negative workflow run. A queued/unassigned job with `runner_id=0` and zero steps is expected negative evidence.

## Protected-main requirements

Before any disposable runner registration, live repository settings must prove all of the following:

1. `main` is protected using the sandbox's approved classic branch-protection contract.
2. Changes to `main` require a pull request.
3. Code-owner review is required for the protected trust-boundary paths when the repository's reviewer topology can satisfy that rule.
4. Administrator enforcement is enabled and pull-request bypass allowances are exactly empty.
5. Force pushes and branch deletion are disabled.
6. The required `contract` status check is preserved.

### Single-owner reviewer caveat

At bootstrap, `@wswitzer` is both the commit author and the only configured code owner. GitHub does not allow a pull-request author to approve their own PR. Therefore **do not enable an unsatisfiable code-owner-approval requirement until a distinct eligible reviewer/team exists**. Until then, the sandbox may prove PR-only protection, required checks, and no-bypass semantics, while CODEOWNERS documents the intended protected paths. The future Pure Linguistics cutover must resolve this reviewer topology before claiming code-owner-review enforcement.

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

## Fail-closed conditions

Do not register the disposable runner if any of these are false or unknown:

- repository ID is exactly `1358786256`;
- `main` protection satisfies the approved sandbox configuration with zero bypass allowances;
- runner group visibility is `selected`;
- selected repository set is exactly this repository;
- public access is enabled only because this dedicated group targets this public sandbox;
- workflow restriction is enabled;
- selected workflow set is exactly the trusted `@refs/heads/main` workflow;
- group contains zero runners before commissioning;
- the candidate runner has no reusable credentials, secrets, client data, host mounts, Azure/database access, or prior worktree state.

## What this can prove before Team

A successful canary can prove that GitHub's selected-workflow scheduler lets the protected-main trusted workflow acquire a runner while an unauthorized workflow targeting the same group/labels cannot.

It cannot prove that Pure Linguistics private `main` protection is actually enforced. After Team is enabled, PL still needs live readback of its private branch/ruleset protection and its own runner-group configuration before any persistent PL runner assignment.
