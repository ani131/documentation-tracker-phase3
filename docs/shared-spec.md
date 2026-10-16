# Phase 3 implementation specification and pod clarifications

Team 16, Documentation Tracker; pod: Teams 15 and 16. Derived from the supplied Phase 2 Version 1 prose and the course Cross-team Testing Interface handout. **This file records implementation choices, not a newly approved shared pod specification.** Team 15 agreement is pending.

- System base: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/system
- Tester base: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/tester
- Machine-readable system contract: [openapi-system.json](openapi-system.json)
- Machine-readable tester contract: [openapi-tester.json](openapi-tester.json)
- Fixed fixture: [manifest](../fixtures/manifest.json)

## Input and preparation

`POST /analyze` accepts `repository` as owner/name, `commit_id` as 7-40 hex characters and optional `base_commit` with the same syntax. Full commit IDs are recommended. Extra fields, wrong types, malformed JSON, oversized bodies and invalid repository names return 400 INVALID_REQUEST. Maximum body size: 16 KiB. Commit lookup produces full 40-character IDs. If base is omitted, use the first parent; a root commit has a null base and is compared to an empty tree. Branch names are outside this increment.

System setup accepts `{"session_id":"unique-id","setup":{}}`. No fixtures are mutated and no previous analyses are deleted. The optional `X-Test-Session` header identifies a prepared session; no header is required for ordinary project calls. Unknown supplied sessions return 404. Concurrent sessions use distinct immutable result IDs. There is no public reset/delete endpoint; staff should create fresh session IDs. Data persists across deployments; only an owner may perform storage cleanup through hosting administration.

## Classification and results

Classification precedence: requirement directories, specification directories, architecture/, design/, supported source extensions, then OTHER. Rules and supported extensions are in `src/analysis.mjs`; changing them requires a new configuration version. Changes contain `path`, `change_type` (ADDED/MODIFIED/DELETED), and `category`. Renames normalize to deletion plus addition. Arrays are sorted by path. Root files and copies are supported. Incomplete, paginated, divergent, reverse or 300-or-more-file comparisons yield a saved ERROR result with a skipped-check explanation. These conservative limits avoid silently accepting truncated GitHub output.

Results contain `analysis_id`, repository, full head/base commit IDs, `configuration_version`, `tool_version`, `created_at`, status, changes, issues, skipped and error. Phase 3 intentionally returns an empty issues array: no documentation detector runs. SUCCESS means the delivered change-analysis checks completed; it makes no claim that documentation is current or legally compliant. GET `/analysis/{analysis_id}` retrieves the unchanged saved JSON; unknown IDs return 404 ANALYSIS_NOT_FOUND. Project errors also contain a nonempty message and source.

## Tester behavior

POST `/test/setup` takes target_url, generates a UUID, calls the target system setup with that UUID, and returns 201 only after successful preparation. POST `/test/run` executes the 14 cases in `src/tester.mjs` exactly once, in order. Concurrent/later calls return 409, including after abort. GET `/test/report?session_id=...` returns 409 until execution ends, then retrieves the saved report. Setup failures preserve the system's status, message and source. Errors use source tester/system/communication/unknown. Reports retain failures and contain every planned test exactly once.

Target URLs are HTTPS base URLs without credentials/query/fragment or a /test suffix. Our own /system is approved. For another podmate URL, the owner adds the exact base URL to the `APPROVED_TARGETS` runtime value and redeploys. This controls outbound requests without changing test code. Local-only development can set LOCAL_TEST=1; it is not enabled in the deployed service.

## Time limits and availability

Register: system setup 10 seconds; tester setup 60 seconds; tester run 300 seconds; project analysis 55 seconds; ordinary retrieval/report 15 seconds. GitHub calls use 10-second deadlines, and the suite limits project-call execution to 180 seconds. No automatic retry of a project POST or tester run occurs. Retrieve a report after a lost response; create a fresh session to repeat the suite. A crash may leave the previous session unresolved.

Full-SHA commit/comparison metadata is cached persistently because the Git objects are immutable. Repository visibility and abbreviated references are checked/cached for 10 minutes. Cache reuse does not replace the creation of a fresh immutable analysis result. GitHub denied access/quota or network failures still return explicit 500s when required metadata is unavailable. Anonymous public-page status may establish a public repository or 404, without inventing commit data.

## Coverage and unresolved pod decisions

The common Phase 2 AC inventory is AC-01 through AC-10. Our full suite exercises AC-01, AC-07 and AC-10; AC-06 retrieval and AC-08 resource checks are partial. Per-session source-line coverage is uninstrumented, so both counts are null. No pod component inventory/exercise rule was supplied, so component counts are also null. Proposed components for pod agreement are input validation, repository resolution, classification, evidence persistence/retrieval, and the test-session adapter. Agree on the inventory before assigning numeric component coverage; do not infer a value from Team 16 internals.

Decisions needed from both teams: exact result/change field names; classification precedence and rename semantics; first-parent/root behavior; optional session header; complete component coverage inventory; unsupported-file/size rules; and mapping/review policies for Phases 4/5. The Phase 2 owner/name rule is followed; its ownerless sample input is inconsistent and should be corrected. No pod agreement, teammate cross-test or instructor sign-off is claimed.
