# local-ci-simple

Disposable public GitHub trust-boundary sandbox for proving the simplest safe path to owner-controlled self-hosted CI.

This repository does **not** contain client application code and is not a production runner configuration. It exists to prove the GitHub-native boundary needed by Pure Linguistics before the private repository is upgraded to a plan that can enforce the equivalent protected-`main` controls.

The experiment is intentionally narrow and currently uses an explicit **single-writer owner-controlled trust root**: `@wswitzer` must be the only merge-capable collaborator. This sandbox does not claim two-person/CODEOWNER approval enforcement; that remains mandatory for the future Pure Linguistics cutover.

1. protect `main` so the selected workflow on `refs/heads/main` is a trusted control surface;
2. restrict a dedicated organization runner group to this repository and `.github/workflows/trusted-local-ci.yml@refs/heads/main`;
3. prove that this dedicated group is the only self-hosted runner group GitHub exposes to the public sandbox;
4. prove that the selected trusted workflow can acquire a disposable runner while a different workflow targeting the same group/labels cannot;
5. keep the runner credential-free, code-free, disposable, and isolated; and
6. leave zero sandbox runners registered after the canary.

See [`docs/TRUST-BOUNDARY.md`](docs/TRUST-BOUNDARY.md) for the security contract and [`docs/ACTIVATION.md`](docs/ACTIVATION.md) for the read-only preflight and live canary procedure.
