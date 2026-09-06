import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const trustedPath = '.github/workflows/trusted-local-ci.yml';
const unauthorizedPath = '.github/workflows/unauthorized-local-ci-probe.yml';

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
  assert.match(job, /github\.actor == 'wswitzer'/);
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

test('CODEOWNERS covers every security-sensitive sandbox contract surface', async () => {
  const codeowners = await read('.github/CODEOWNERS');
  const required = [
    '/.github/CODEOWNERS @wswitzer',
    '/.github/workflows/trusted-local-ci.yml @wswitzer',
    '/docs/TRUST-BOUNDARY.md @wswitzer',
    '/docs/ACTIVATION.md @wswitzer',
    '/scripts/preflight-github.sh @wswitzer',
    '/tests/trust-contract.test.mjs @wswitzer',
  ];
  for (const line of required) assert.match(codeowners, new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('trust contract fixes the exact repo/workflow identity and forbids persistent public runners', async () => {
  const contract = await read('docs/TRUST-BOUNDARY.md');
  assert.match(contract, /selected_repository_ids": \[1358786256\]/);
  assert.match(contract, /allows_public_repositories": true/);
  assert.match(contract, /restricted_to_workflows": true/);
  assert.match(contract, /Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main/);
  assert.match(contract, /disposable canary/i);
  assert.match(contract, /Never reuse the Pure Linguistics runner group or a persistent trusted runner/i);
  assert.match(contract, /Single-owner reviewer caveat/);
});

test('activation requires readback before registration and zero-runner rollback', async () => {
  const activation = await read('docs/ACTIVATION.md');
  assert.match(activation, /separate explicit owner approval for the exact registration operation/i);
  assert.match(activation, /preflight-github\.sh/);
  assert.match(activation, /zero sandbox runners/i);
  assert.match(activation, /Do not reuse `Default`, `plos-local-ci`, the canonical `local-ci-r1`, or `local-ci-r2`/);
});

test('preflight is read-only and checks branch and exact runner-group state', async () => {
  const script = await read('scripts/preflight-github.sh');
  assert.match(script, /repo_id="1358786256"/);
  assert.match(script, /group_name="local-ci-simple-canary"/);
  assert.match(script, /selected_workflow="Switzer-Systems\/local-ci-simple\/\.github\/workflows\/trusted-local-ci\.yml@refs\/heads\/main"/);
  assert.match(script, /\.protected/);
  assert.match(script, /enforce_admins\.enabled/);
  assert.match(script, /required status checks do not include contract/);
  assert.match(script, /restricted_to_workflows/);
  assert.match(script, /runner_count.*0/s);
  assert.doesNotMatch(script, /gh\s+api\s+[^\n]*(--method|-X)\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(script, /gh\s+(repo|api).*delete/i);
});
