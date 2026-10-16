# Documentation Tracker — Phase 3

Read-only change analysis for public GitHub repositories, immutable analysis evidence, and the required cross-team HTTP tester.

- Dashboard: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site
- Readable API explorer: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/api-docs
- Finish Phase 3: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/api-docs#finish-phase3
- System base: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/system
- Tester base: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/tester
- System contract: [OpenAPI](docs/openapi-system.json)
- Tester contract: [OpenAPI](docs/openapi-tester.json)
- Fixed acceptance fixture: [manifest](fixtures/manifest.json), `fixtures` branch

The implementation delivers repository resolution, deterministic classification, validation and saved-result retrieval. Missing/outdated documentation detection is scheduled for Phase 4; human review authorization is scheduled for Phase 5. Empty `issues` means no detector ran, not that documentation is compliant.

## Run checks locally

Use Node.js 24 or newer:

```sh
npm ci
npm run check
npm test
npm run build
```

Unit/API tests use a real SQLite schema and fake read-only GitHub responses. Deployed tests use fixed commits in the public `fixtures` branch.

```sh
npm run test:deployed
# Point our tester at an approved podmate system without editing code:
node scripts/run-deployed.mjs --system-url https://podmate.example/system
```

For raw HTTP calls, POST `{ "target_url": "<system-base>" }` to `<tester-base>/test/setup`, then POST the returned `{ "session_id": "..." }` to `<tester-base>/test/run` exactly once. Retrieve a lost/aborted response through GET `<tester-base>/test/report?session_id=...`; never repeat the run. Each suite has 14 tests. Target URLs must be approved in `APPROVED_TARGETS` to prevent SSRF; the deployed system is approved by default.

## Implementation

Vinext/React route handlers call the standalone ES module service. Public GitHub REST metadata supplies immutable commit IDs and file changes. R2 stores one immutable JSON object per analysis; D1 stores session state, metadata cache and redacted operational events. No repository code, shell commands or LLM is executed by the detector. The hosted runtime needs `DB` and `BUCKET` bindings and the checked-in Drizzle migration.

This repository includes the supplied Sites framework scaffold and its license notices; unused UI components/examples are not running system components.

## Status

- [Phase 3 writeup](docs/phase3-writeup.md)
- [Delivered system models](docs/models.md)
- [Operating/common-spec clarifications](docs/shared-spec.md)
- [Hosted test evidence](docs/evidence/deployed-run.json)
- [Registry row](docs/registry-entry.csv)
- [Remaining submission/pod steps](docs/submission-checklist.md)

Cross-team results and class-registry changes are pending. Do not substitute self-testing for the required partner tests.
