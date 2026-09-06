# Local CI Simple Sandbox Guidance

## Purpose

This repository is a disposable, public GitHub trust-boundary sandbox for proving selected-workflow self-hosted-runner controls before applying the equivalent design to a private client repository.

## Non-negotiable invariants

- Synthetic/test data only. Never add client or production data.
- Never commit secrets, tokens, private keys, credentials, or generated credential-bearing files.
- Never register or assign a self-hosted runner without explicit owner approval for that exact operation.
- Any runner used with this public repository must be disposable, credential-free, and isolated from client repositories, Azure, databases, the host filesystem, and reusable credentials.
- Never mutate Pure Linguistics repositories, Azure resources, or `Switzer-Systems/local-ci-platform` from this repository's implementation lane.
- Runner labels are routing metadata, never authorization.
- Selected-workflow runner-group policy plus protected default-branch governance is the security boundary being tested.
- The trusted canary must not use `pull_request_target`, checkout target/application code, request OIDC, consume secrets, or execute third-party actions.
- Fail closed when repository identity, branch protection, workflow identity, runner-group configuration, actor identity, or expected SHA cannot be proven exactly.

## Working rules

- Keep the trusted workflow minimal, manual-only, and code-free.
- Keep an explicitly unauthorized workflow that targets the same future runner group/labels for negative acquisition testing.
- Protect the trusted workflow, CODEOWNERS, trust contract, and focused tests with CODEOWNERS.
- Live GitHub organization/repository settings must be read back before runner registration; repository files alone are not evidence of live enforcement.
- Public-repository runner testing must have a mandatory cleanup/rollback path and leave zero registered sandbox runners afterward.
- Do not substitute a custom JIT/pre-worker admission design for the narrower GitHub-native selected-workflow experiment unless the issue is explicitly re-contracted.

## Verification expectations

Before handoff, run or obtain deterministic evidence for the focused contract tests and `git diff --check`. Runtime scheduling/acquisition claims require exact GitHub run/job/runner evidence; never infer live success from source inspection alone.
