# Sandbox activation and rollback

This runbook separates repository preparation from live runner registration. Repository implementation alone does **not** authorize a runner.

## Phase A — repository preparation

1. While PR #2 is still open, configure **classic branch protection** for public-repository `main`: require pull requests, require the `contract` status check, enforce the rule for administrators, configure zero bypass allowances, and disallow force pushes and branch deletion.
2. Operate this bootstrap sandbox under the explicitly reduced **single-writer owner-controlled trust root**. `@wswitzer` must be the only merge-capable collaborator; CODEOWNERS is metadata only until a distinct eligible reviewer exists. Do not claim CODEOWNER enforcement.
3. Read back the live settings and run `scripts/preflight-github.sh --branch-only`. It must prove branch protection and that `@wswitzer` is the only merge-capable collaborator before merge.
4. Merge the independently reviewed Issue #1 repository changes through the protected `main` path.
5. Run `scripts/preflight-github.sh --branch-only` again from the merged `main` revision and require PASS.

The sandbox uses classic branch protection rather than a repository ruleset so the checked-in preflight can validate the exact live protection object deterministically.

## Phase B — dedicated runner-group preparation

Create a new organization runner group named `local-ci-simple-canary` with exactly:

- visibility: selected;
- selected repository: only `Switzer-Systems/local-ci-simple` (ID `1358786256`);
- public repositories: allowed **for this group only**;
- restricted to selected workflows: true;
- selected workflow: `Switzer-Systems/local-ci-simple/.github/workflows/trusted-local-ci.yml@refs/heads/main`;
- runners: zero initially.

Do not reuse `Default`, `plos-local-ci`, the canonical `local-ci-r1`, or `local-ci-r2`.

Run:

```bash
./scripts/preflight-github.sh
```

The script is read-only. It must PASS before runner registration. In addition to validating the dedicated group itself, it queries GitHub's repository-visible runner-group view and requires `local-ci-simple-canary` to be the **only runner group visible to this repository**. Any additional visible/inherited group blocks commissioning.

## Phase C — disposable runner commissioning

Requires separate explicit owner approval for the exact registration operation.

The disposable runner must:

- run in a disposable isolated VM/guest or equivalent throwaway environment;
- contain no GitHub credentials except the short-lived registration/session material needed for this sandbox;
- contain no Azure, database, client, PL, SSH-agent, host-filesystem, Docker-socket, cloud, package-registry, or other reusable credentials;
- have an empty work directory;
- be assigned only to `local-ci-simple-canary`;
- use the custom label `local-ci-simple-canary`;
- be deleted/unregistered immediately after the test window.

Record exact runner ID, name, version, labels, group ID, online/idle state, and registration time.

## Phase D — positive acquisition

1. Read current `main` SHA.
2. Dispatch `Trusted local CI acquisition canary` from `main` with:
   - `expected_sha=<exact current main SHA>`
   - `confirmation=RUN-DISPOSABLE-CANARY`
3. Require the authorize job to be assigned to the disposable runner.
4. Record run ID, job ID, runner ID, runner-group ID, workflow ref, workflow SHA, head SHA, actor ID, start/end time, conclusion, and step list.
5. Confirm no checkout/action download, secret, OIDC, target code, or external credential use occurred.

Expected result: success on the disposable runner.

## Phase E — negative acquisition

With the same runner still online/idle, manually dispatch `Unauthorized local CI acquisition probe`.

Expected result after an observation window: the job remains unassigned to the selected group; the marker step never runs. Record run/job data showing no runner assignment and zero executed steps. Cancel the queued run after evidence is collected.

Do **not** add the unauthorized workflow to the runner group's selected-workflow list.

Optional later negative cases may include a deliberately wrong expected SHA on the trusted workflow. That case should be rejected by the trusted job condition and must not be treated as proof of the server-side selected-workflow restriction.

## Phase F — mandatory rollback

Immediately after positive/negative evidence:

1. Cancel any queued sandbox run.
2. Stop the disposable runner listener.
3. Remove the runner from `local-ci-simple-canary`.
4. Remove local registration/session material and the work directory.
5. Read back the group and organization runner lists; require zero sandbox runners.
6. Destroy the disposable VM/guest if it was created solely for this experiment.
7. Retain only nonsecret run/job/readback evidence.

If cleanup cannot be proven, treat the canary as failed and do not proceed toward PL commissioning.

## Phase G — future Pure Linguistics Team cutover

Once Pure Linguistics has a plan that can enforce the private-repository controls, repeat the security proof on the live PL repository rather than assuming sandbox equivalence:

1. protect private `main` with the approved PR/reviewer/no-bypass policy;
2. resolve the code-owner reviewer topology so required code-owner review is genuinely enforceable;
3. read back the PL runner group as selected repository only, public disabled, selected workflow exactly `Pure-Linguistics/Pure-Linguistics-LMS/.github/workflows/trusted-local-ci.yml@refs/heads/main`;
4. confirm labels remain routing only;
5. run a PL-specific code-free authorized-vs-unauthorized acquisition canary;
6. only then proceed to the separate r1 target-execution/Azure/database commissioning gates.
