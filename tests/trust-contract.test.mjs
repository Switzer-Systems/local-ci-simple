import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const trustedPath = '.github/workflows/trusted-local-ci.yml';
const unauthorizedPath = '.github/workflows/unauthorized-local-ci-probe.yml';
const contractPath = '.github/workflows/contract.yml';

const expectedTrustedWorkflow = String.raw`name: Trusted local CI acquisition canary

on:
  workflow_dispatch:
    inputs:
      expected_sha:
        description: Exact current main SHA expected by the operator
        required: true
        type: string
      confirmation:
        description: Type RUN-DISPOSABLE-CANARY to authorize this synthetic probe
        required: true
        type: string

permissions: {}

concurrency:
  group: local-ci-simple-trusted-canary
  cancel-in-progress: true

jobs:
  authorize:
    if: >-
      github.repository == 'Switzer-Systems/local-ci-simple' &&
      github.event_name == 'workflow_dispatch' &&
      github.ref == 'refs/heads/main' &&
      github.workflow_ref == 'Switzer-Systems/local-ci-simple/.github/workflows/trusted-local-ci.yml@refs/heads/main' &&
      github.workflow_sha == github.sha &&
      github.actor == 'wswitzer' &&
      github.actor_id == '112133527' &&
      github.triggering_actor == 'wswitzer' &&
      inputs.confirmation == 'RUN-DISPOSABLE-CANARY' &&
      inputs.expected_sha == github.sha
    runs-on:
      group: local-ci-simple-canary
      labels: [self-hosted, Linux, ARM64, local-ci-simple-canary]
    timeout-minutes: 2
    steps:
      - name: Record code-free acquisition evidence
        shell: bash
        run: |
          set -euo pipefail
          printf 'repository=%s\n' "$GITHUB_REPOSITORY"
          printf 'ref=%s\n' "$GITHUB_REF"
          printf 'sha=%s\n' "$GITHUB_SHA"
          printf 'actor=%s\n' "$GITHUB_ACTOR"
          printf 'actor_id=%s\n' "$GITHUB_ACTOR_ID"
          printf 'workflow_ref=%s\n' "$GITHUB_WORKFLOW_REF"
          printf 'workflow_sha=%s\n' "$GITHUB_WORKFLOW_SHA"
          printf 'runner=%s\n' "$RUNNER_NAME"
`;

test('trusted canary exactly matches the audited manual-only, code-free fixture', async () => {
  const workflow = await read(trustedPath);
  assert.equal(
    workflow,
    expectedTrustedWorkflow,
    'trusted workflow changed outside the exact audited workflow_dispatch-only metadata canary fixture',
  );
});

test('unauthorized probe deliberately targets identical group and labels without secrets', async () => {
  const [trusted, unauthorized] = await Promise.all([read(trustedPath), read(unauthorizedPath)]);

  const target = /group: local-ci-simple-canary[\s\S]*labels: \[self-hosted, Linux, ARM64, local-ci-simple-canary\]/;
  assert.match(trusted, target);
  assert.match(unauthorized, target);
  assert.match(unauthorized, /^permissions: \{\}$/m);
  assert.match(unauthorized, /SECURITY FAILURE: unauthorized workflow acquired the selected runner group/);
  assert.doesNotMatch(unauthorized, /pull_request_target/);
  assert.doesNotMatch(unauthorized, /\buses:/);
  assert.doesNotMatch(unauthorized, /secrets\./i);
  assert.doesNotMatch(unauthorized, /id-token\s*:\s*write/i);
});

test('CODEOWNERS covers the entire security sandbox', async () => {
  const codeowners = await read('.github/CODEOWNERS');
  assert.match(codeowners, /^\* @wswitzer$/m);
  assert.match(codeowners, /single-writer owner trust root/i);
});

test('actionlint knows the intentional custom self-hosted runner label', async () => {
  const config = await read('.github/actionlint.yaml');
  assert.match(config, /^self-hosted-runner:\n  labels:\n    - local-ci-simple-canary$/m);
});

test('hosted contract CI is pinned and runs the focused deterministic security checks', async () => {
  const workflow = await read(contractPath);

  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 5/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version: '24'/);
  assert.match(workflow, /git diff --check/);
  assert.match(workflow, /ACTIONLINT_VERSION: '1\.7\.12'/);
  assert.match(workflow, /ACTIONLINT_SHA256: '[0-9a-f]{64}'/);
  assert.match(workflow, /SHELLCHECK_VERSION: '0\.11\.0'/);
  assert.match(workflow, /SHELLCHECK_SHA256: '[0-9a-f]{64}'/);
  assert.match(workflow, /shellcheck --shell=bash scripts\/preflight-github\.sh/);
  assert.match(workflow, /actionlint -shellcheck=/);
  assert.match(workflow, /ghcr\.io\/zizmorcore\/zizmor@sha256:[0-9a-f]{64}/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /dst=\/repo,readonly/);
  assert.match(workflow, /--offline/);
  assert.match(workflow, /--strict-collection/);
  assert.match(workflow, /--collect=workflows/);
  assert.match(workflow, /--persona=regular/);
  assert.match(workflow, /--format=github/);
  assert.doesNotMatch(workflow, /zizmorcore\/zizmor-action@/);
  assert.doesNotMatch(workflow, /GH_TOKEN|GITHUB_TOKEN|ZIZMOR_GITHUB_TOKEN/);
  assert.doesNotMatch(workflow, /pull_request_target/);

  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  assert.equal(uses.length, 2, 'contract workflow should only use pinned checkout and setup-node actions');
  for (const use of uses) assert.match(use, /@[0-9a-f]{40}$/, `action must be pinned to an exact SHA: ${use}`);
});

test('trust contract fixes exact repo/workflow identity and forbids persistent public runners', async () => {
  const contract = await read('docs/TRUST-BOUNDARY.md');
  assert.match(contract, /selected_repository_ids": \[1358786256\]/);
  assert.match(contract, /allows_public_repositories": true/);
  assert.match(contract, /restricted_to_workflows": true/);
  assert.match(contract, /Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main/);
  assert.match(contract, /zero bypass allowances/i);
  assert.match(contract, /actionlint `v1\.7\.12`/);
  assert.match(contract, /ShellCheck `v0\.11\.0`/);
  assert.match(contract, /zizmor `v1\.29\.0`/);
  assert.match(contract, /receives no GitHub token or other credentials/i);
  assert.match(contract, /disposable canary/i);
  assert.match(contract, /Never reuse the Pure Linguistics runner group or a persistent trusted runner/i);
  assert.match(contract, /Single-writer owner-controlled trust root/);
  assert.match(contract, /only runner group visible to this public repository/i);
});

test('activation protects main before merge and requires readback before registration', async () => {
  const activation = await read('docs/ACTIVATION.md');
  const protect = activation.indexOf('configure **classic branch protection**');
  const merge = activation.indexOf('Merge the independently reviewed Issue #1 repository changes');
  assert.ok(protect >= 0 && merge >= 0 && protect < merge, 'main protection must be configured before PR #2 is merged');
  assert.match(activation, /zero bypass allowances/i);
  assert.match(activation, /only merge-capable collaborator/i);
  assert.match(activation, /only runner group visible to this repository/i);
  assert.match(activation, /separate explicit owner approval for the exact registration operation/i);
  assert.match(activation, /preflight-github\.sh/);
  assert.match(activation, /zero sandbox runners/i);
  assert.match(activation, /Do not reuse `Default`, `plos-local-ci`, the canonical `local-ci-r1`, or `local-ci-r2`/);
});

test('preflight is read-only and closes collaborator and runner-group visibility gaps', async () => {
  const script = await read('scripts/preflight-github.sh');
  assert.match(script, /repo_id="1358786256"/);
  assert.match(script, /owner_login="wswitzer"/);
  assert.match(script, /group_name="local-ci-simple-canary"/);
  assert.match(script, /selected_workflow="Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main"/);
  assert.match(script, /\.protected/);
  assert.match(script, /enforce_admins\.enabled/);
  assert.match(script, /bypass_pull_request_allowances/);
  assert.match(script, /bypass_count.*0/s);
  assert.match(script, /required status checks do not include contract/);
  assert.match(script, /collaborators\?affiliation=all&per_page=100/);
  assert.match(script, /other_merge_capable_count.*0/s);
  assert.match(script, /visible_to_repository=local-ci-simple&per_page=100/);
  assert.match(script, /visible_group_count.*1/s);
  assert.match(script, /restricted_to_workflows/);
  assert.match(script, /runner_count.*0/s);
  assert.doesNotMatch(script, /gh\s+api\s+[^\n]*(--method|-X)\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(script, /gh\s+(repo|api).*delete/i);
});
