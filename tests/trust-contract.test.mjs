import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const trustedPath = '.github/workflows/trusted-local-ci.yml';
const unauthorizedPath = '.github/workflows/unauthorized-local-ci-probe.yml';
const contractPath = '.github/workflows/contract.yml';

function trustedJobBlock(workflow) {
  const match = workflow.match(/\n  authorize:\n([\s\S]*)$/);
  assert.ok(match, 'trusted workflow must contain authorize job');
  return match[1];
}

test('trusted canary is manual-only, read-only/code-free, and exact-identity gated', async () => {
  const workflow = await read(trustedPath);
  const job = trustedJobBlock(workflow);

  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s{2}(pull_request|push|schedule|workflow_call|repository_dispatch):/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /^permissions: \{\}$/m);

  assert.match(job, /github\.repository == 'Switzer-Systems\/local-ci-simple'/);
  assert.match(job, /github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /github\.ref == 'refs\/heads\/main'/);
  assert.match(job, /github\.workflow_ref == 'Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main'/);
  assert.match(job, /github\.workflow_sha == github\.sha/);
  assert.match(job, /github\.actor == 'wswitzer'/);
  assert.match(job, /github\.actor_id == '112133527'/);
  assert.match(job, /github\.triggering_actor == 'wswitzer'/);
  assert.match(job, /inputs\.confirmation == 'RUN-DISPOSABLE-CANARY'/);
  assert.match(job, /inputs\.expected_sha == github\.sha/);

  assert.match(job, /group: local-ci-simple-canary/);
  assert.match(job, /labels: \[self-hosted, Linux, ARM64, local-ci-simple-canary\]/);
  assert.doesNotMatch(job, /\buses:/);
  assert.doesNotMatch(job, /actions\/checkout/i);
  assert.doesNotMatch(job, /secrets\./i);
  assert.doesNotMatch(job, /id-token\s*:\s*write/i);
  assert.doesNotMatch(job, /curl\s|wget\s|ssh\s|gh\s+api/i);
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
  assert.match(workflow, /zizmorcore\/zizmor-action@[0-9a-f]{40}/);
  assert.match(workflow, /version: '1\.29\.0'/);
  assert.match(workflow, /online-audits: false/);
  assert.match(workflow, /advanced-security: false/);
  assert.match(workflow, /token: ''/);
  assert.doesNotMatch(workflow, /pull_request_target/);

  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 3, 'contract workflow should have pinned checkout, setup-node, and zizmor actions');
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
  assert.match(contract, /disposable canary/i);
  assert.match(contract, /Never reuse the Pure Linguistics runner group or a persistent trusted runner/i);
  assert.match(contract, /Single-owner reviewer caveat/);
});

test('activation protects main before merge and requires readback before registration', async () => {
  const activation = await read('docs/ACTIVATION.md');
  const protect = activation.indexOf('configure **classic branch protection**');
  const merge = activation.indexOf('Merge the independently reviewed Issue #1 repository changes');
  assert.ok(protect >= 0 && merge >= 0 && protect < merge, 'main protection must be configured before PR #2 is merged');
  assert.match(activation, /zero bypass allowances/i);
  assert.match(activation, /separate explicit owner approval for the exact registration operation/i);
  assert.match(activation, /preflight-github\.sh/);
  assert.match(activation, /zero sandbox runners/i);
  assert.match(activation, /Do not reuse `Default`, `plos-local-ci`, the canonical `local-ci-r1`, or `local-ci-r2`/);
});

test('preflight is read-only and checks branch, bypass, and exact runner-group state', async () => {
  const script = await read('scripts/preflight-github.sh');
  assert.match(script, /repo_id="1358786256"/);
  assert.match(script, /group_name="local-ci-simple-canary"/);
  assert.match(script, /selected_workflow="Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main"/);
  assert.match(script, /\.protected/);
  assert.match(script, /enforce_admins\.enabled/);
  assert.match(script, /bypass_pull_request_allowances/);
  assert.match(script, /bypass_count.*0/s);
  assert.match(script, /required status checks do not include contract/);
  assert.match(script, /restricted_to_workflows/);
  assert.match(script, /runner_count.*0/s);
  assert.doesNotMatch(script, /gh\s+api\s+[^\n]*(--method|-X)\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(script, /gh\s+(repo|api).*delete/i);
});
