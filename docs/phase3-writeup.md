# Project Phase 3: Initial Delivery

**Documentation Tracker | Team 16 | Pod: Teams 15 and 16**

Prepared for Anish Paspuleti. Delivery date: October 16, 2026. Implementation version tested: `ac5196ab16429071e69f33e7236de9d57c80a867` (tool version 3.0.0, configuration classification-v1). Repository: https://github.com/ani131/documentation-tracker-phase3. Service: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site. This is an evidence-based submission draft: class-registry publication, partner tests, shared-contract approval and teammate-specific GenAI statements remain pending and are explicitly identified below.

## Q1.1 Increment description

Delivered capability: An engineer can submit a public GitHub repository and fixed commit IDs, receive deterministically classified changes, and retrieve the original saved analysis later. Team 16 delivered the Phase 3 version-resolution, change-classification, validation and evidence-retrieval increment, plus the separately addressable tester required by the course handout. The users are engineering/compliance staff at general-purpose AI model providers, together with podmates and graders comparing implementations. Traceable change evidence supports the documentation-maintenance workflow associated with Article 53(1)(a) and Annex XI of the EU AI Act; the service does not decide legal compliance [1, Article 53(1)(a), Annex XI]. Read-only GitHub commit/comparison metadata supplies file changes without executing repository code [2, Get a commit; Compare two commits]. Documentation findings and authorized review remain scheduled for later milestones, so an empty issues array is not evidence that documentation is current.

- REQ-01 - Detect/classify changes | Status: complete within supported input limits | Demonstrated by AC-01: T-01, T-03, T-13 and classification/root/rename unit tests.
- REQ-04 - Traceable immutable evidence | Status: complete for the delivered analysis evidence | Demonstrated by initial AC-06: T-02, T-14, separate UUID JSON objects and application-store recreation tests. Deployment-replacement retrieval is recorded in `docs/evidence/persistence-check.json`; the platform does not expose a forced process-restart control.
- REQ-05 - Explicit inputs/failures | Status: partial across full semester scope; Phase 3 paths implemented | Demonstrated by AC-07 and ordinary AC-08: T-04 through T-11 plus injected upstream/storage/incomplete-comparison tests. Missing: mapping-specific required-check failures, scheduled for Phase 4.
- REQ-06 - Read-only/safe analysis | Status: partial across full semester scope | Demonstrated by AC-09 read-only URL/method inspection and tests that do not execute scripts or expose exceptions. Missing: authorized-review records and permission enforcement, scheduled for Phase 5.
- REQ-07 - Consistent testable interface | Status: partial pending common-schema clarification approval | Demonstrated by AC-10/T-12, exported OpenAPI, two base URLs, deterministic output and tester lifecycle tests. Missing: Team 15 agreement on the clarified fields/rules and cross-team evidence.

## Q1.2 Comparison with the Phase 2 plan

The delivered service implements the Phase 2 Section 6.1 milestone: network access, validated requests, commit resolution, basic change classification and saved-result retrieval. It also includes the course-wide system/tester setup/report protocol, which was absent from the two-operation Phase 2 prose. The proposed container/FastAPI and Git-based evidence repository were changed to a Vinext Worker and managed D1/R2 storage while preserving the externally observable increment. Documentation detection and human review were not Phase 3 milestone items and remain in Phases 4 and 5; no instructor-directed shared-scope reduction was provided or claimed.

## Q2.1 Deployed web service

The public HTTPS service runs through Sites on Cloudflare Workers, with Vinext 1.0.0-beta.5 and React 19.2.6; Worker routing is geographically distributed, while the hosting tools do not expose a specific database region [3, README: deployment/runtime]. The tested source is commit `ac5196ab16429071e69f33e7236de9d57c80a867`, also returned by `/health`; release publication builds the checked-in source, pushes that exact commit to hosting, saves a version and deploys it, with the same runtime source mirrored to GitHub. Endpoints have no intentional sleep schedule and require no grader authentication, but provider outages, GitHub access failures and quotas can interrupt service. No paid plan or billing change was initiated, exact Sites account quotas/costs were not exposed, and anonymous GitHub REST calls are generally limited to 60/hour per source IP, mitigated by metadata caching [4, Primary rate limit for unauthenticated users].

## Q2.2 Registry and team documentation

Readable interactive API guide: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/api-docs. It explains all seven required operations, request fields, examples and response statuses, and provides editable requests, actual responses, copyable cURL commands and the setup/run/report workflow. The remaining submission steps are linked at https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/api-docs#finish-phase3. These are presentation improvements; the API contract remains version 3.0.0.

Registry entry: **not yet updated**; the class spreadsheet URL was not supplied. A ready-to-copy row is in `docs/registry-entry.csv`, dated 2026-10-16; copying it to the actual class registry is still required. Team documentation: https://github.com/ani131/documentation-tracker-phase3/tree/main/docs | Updated on: 2026-10-16. It contains this report, current models, both OpenAPI documents, operating instructions, delivered functionality and known limitations; the proposed common-spec clarifications require Team 15 agreement.

## Q2.3 Operational experience and observability evidence

The Phase 2 operation plan evolved from GitHub evidence files to D1 session/cache/event records and one R2 JSON object per analysis, separated from all analyzed repositories [5, Overview; 6, Workers API: put/get and conditional operations]. No runtime GitHub credential or LLM key is needed; hosting binds DB/BUCKET, release SHA is a nonsecret runtime value, and any future credential must be a read-only secret rather than a personal repository-write token. Fresh UUID sessions/results avoid destructive resets, and no public deletion operation is exposed. Structured events and `/system/metrics` show completion/error counts, elapsed time and result IDs without request bodies, tokens or source patches; their excerpt below was captured from the deployed service at 2026-10-16 05:28:49 PM EDT.

```json
{
  "event": "analysis_completed",
  "status": "SUCCESS",
  "elapsed_ms": 620,
  "analysis_id": "567662af-5f3b-4ffc-8b3d-28d7c892b326",
  "created_at": "2026-10-16T21:28:47.038Z"
}
```

## Q3.1 Operation status

The original Phase 2 project API contains both operations below; the additional rows implement the supplied course-wide testing handout. Success/error conformance below is to the exported Team 16 implementation schemas, not an assertion of unrecorded pod approval.

| Operation (relative to registered base) | Requirements | Implemented | Success conforms | Error conforms |
| --- | --- | --- | --- | --- |
| System POST /analyze | REQ-01,02,04,05,07 | yes for Phase 3; REQ-02 deferred | yes to delivery schema | yes; 400/404/500; upstream quota may prevent a desired 404 |
| System GET /analysis/{analysis_id} | REQ-04,07 | yes | yes, original saved JSON | yes, 400/404/500 |
| System POST /test/setup | REQ-05,07; course protocol | yes | 201 and supplied ID | 400/409/500 with message/source |
| System GET /test/report | REQ-07; course protocol | yes | code coverage counts null with basis | 400/404/500 with message/source |
| Tester POST /test/setup | REQ-05,07; course protocol | yes | 201 only after target setup | forwards target error; 400/500 with source |
| Tester POST /test/run | REQ-07; course protocol | yes | 200 suite report including failures | 400/404/409; 500 abort with stored report |
| Tester GET /test/report | REQ-07; course protocol | yes | immutable stored report | 400/404/409/500 |

Integration: the React dashboard or an external caller reaches the catch-all route, which delegates to service.mjs and analysis.mjs for validation, GitHub lookup, classification and R2 persistence. The tester uses its own assertions and HTTP requests against the selected system base URL; D1 holds atomic session state, cached metadata and reports. A project response is returned only after the analysis object is saved, while later retrieval reads that object unchanged.

## Q3.2 Contract changes and pod communication

Contract version at delivery: Phase 2 v1 prose, represented by Team 16 OpenAPI 3.0.0. Changes/clarifications: mandatory course test endpoints, explicit change field names and categories, strict owner/name inputs, first-parent/root rules, rename normalization, conservative comparison limits, session header, and target allowlist. These close underspecified details and correct the ownerless Phase 2 example; they are not recorded as pod-approved changes. Pod agreement: **pending**; Team 16 must review the diff with Team 15 before cross-testing and record the date/channel, with instructor approval if the shared scope changes.

## Q4.1 Test runner and execution instructions

Tester base: https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/tester. Base URL override: POST `{"target_url":"<approved-system-base>"}` to `/test/setup`; the returned session ID is passed exactly once to `/test/run`, and a lost response is retrieved through `/test/report?session_id=...`. For a CLI invocation, run `npm ci`, then `node scripts/run-deployed.mjs --system-url <system-base> --tester-url <tester-base>`; no test-code edits are required. Our target requires no authentication or fixture reset; another pod URL must first be added to APPROVED_TARGETS.

Response received: HTTP 200 with one complete suite report, session `47837e62-fb7e-45a0-b697-b85584804234`, 14 unique test results and code/component/system coverage objects. Conforms to the implemented course report schema: yes, checked locally with JSON Schema and inspected in the hosted response [7, Schema Object]. Known common-contract gaps: no supplied agreed detailed project OpenAPI, no agreed component coverage inventory, and no per-session code instrumentation; null counts and explanatory basis fields make those gaps explicit.

## Q4.2 Tests for new functionality

| AC / requirements | Automated tests | Type / scope |
| --- | --- | --- |
| AC-01 / REQ-01 | T-01, T-03, T-13; category precedence, rename/copy and root-boundary tests | success/boundary; full fixed-fixture changed set |
| AC-06 / REQ-04 | T-02, T-14; recreated Store and separate-object tests | success; retrieval/immutability portion; live replacement evidence tracked separately |
| AC-07 / REQ-05 | T-04 through T-08; malformed/null/array/extra/oversized/body-type tests | failure/boundary |
| AC-08 / REQ-05 | T-09 through T-11; upstream denial, network, storage and truncated/divergent comparison tests | failure/boundary; mapping failures deferred |
| AC-09 / REQ-06 | Fixed GitHub GET/method/redirect assertions, script-path metadata check, redacted exception checks and source inspection | automated plus inspection; authorized review deferred |
| AC-10 / REQ-07 | T-12 (five runs); OpenAPI schema compilation/response validation; session/concurrency/report/abort tests | success/failure/boundary |

Oracles: the synthetic fixture's before/after trees were created intentionally, and the eight expected path/type/category entries were written separately in the versioned manifest. Tests use full commit IDs, an explicit rule version and exact JSON fields; there is no runtime generative model. The fixtures have been checked against actual GitHub metadata, but independent Team 15 approval of these expectations is still pending. The local suite uses Node's built-in test runner and coverage measurement [8, Test runner; Collecting code coverage].

## Q4.3 Regression and static checks

All delivered behavior has automated regression coverage even though Phase 2 contained only a design and no prior implementation was supplied. GitHub Actions runs checks/tests/build on pushes and pull requests to main. The suite retains tests for all previous failure fixes and tests both correct results and failure reporting. CI run: https://github.com/ani131/documentation-tracker-phase3/actions/runs/38969574463 | Recorded conclusion: success.

## Q4.4 Static checks

Static validation runs JavaScript syntax checks, TypeScript checking of the React/route/typed scaffold, ESLint on application/service/tests/database code, JSON Schema compilation and OpenAPI snapshot export; the core ES modules are dynamically tested rather than claimed to be fully type-checked. A failed check fails CI, and the deployment workflow used here runs checks/build before packaging; branch-protection enforcement and automatic deployment from CI are not configured. CI run: https://github.com/ani131/documentation-tracker-phase3/actions/runs/38969574463.

## Q4.5 Test results against the deployed system

Run date/time: 2026-10-16 05:28:49 PM EDT | Version tested: `ac5196ab16429071e69f33e7236de9d57c80a867` | Session: `47837e62-fb7e-45a0-b697-b85584804234`.

Tests run: 14 | Passed: 14 | Failed assertions: 0 | Errors: 0 | Skipped: 0. Complete results and live metric evidence: `docs/evidence/deployed-run.json`. These are hosted HTTP results; the separate local suite has 32 passing tests and no skipped tests.

No failing, errored or skipped tests in this recorded run. Earlier runtime/operational failures and their corrections are described below and retained in the engineering history.

Earlier deployment testing exposed unsupported `redirect:error` in the actual Worker runtime and GitHub access/quota failures; the first was corrected to manual redirects and the latter motivated immutable metadata caching and anonymous public-page status fallback. The returned suite never misclassified those earlier server failures as passed tests. Local source-line coverage was 97.99% for analysis.mjs, 96.83% for service.mjs and 100% for tester.mjs/spec.mjs in the recorded run, using controlled upstreams and the real SQLite schema; these percentages are not substituted for unavailable deployed session coverage.

## Q5.1 Model updates

| Model | Changed | What changed and why | Location |
| --- | --- | --- | --- |
| M1 context/component data flow | yes | Worker, read-only GitHub HTTP, D1 and R2 replace proposed container/evidence repository | docs/models.md M1 |
| M2 analysis activity/failure model | yes | actual validation, incomplete checks, immutable write gate and retrieval behavior | docs/models.md M2 |
| M3 information/persistence model | yes | physical records/events tables and separate JSON objects replace planned GitHub run files/review threads | docs/models.md M3 |
| M4 tester state machine | yes | required preparation, atomic one-run claim, report/abort/conflict states | docs/models.md M4 |

The current Mermaid diagrams are included in the linked models artifact and render in GitHub. Planned detectors/review services are not shown as delivered components. The original Phase 2 image files were not provided, so comparison is with its written design descriptions rather than a claimed inspection of those images.

## Q5.2 Model-implementation consistency

The component/data-flow model was checked against the actual route adapter, service, analyzer, tester and D1/R2 calls. The information model uses the two tables in db/schema.ts and the actual analysis object key/fields; the tester state machine was checked against session transition, concurrent-run and abort tests. A concrete divergence is the planned evidence repository/GitHub review-thread architecture: the model was corrected to show R2 JSON objects and D1 state, with review deferred rather than represented as implemented. The diagrams have not yet received a teammate walkthrough, and the two physical stores have logical links rather than a falsely modeled database foreign key.

## Q6.1 Cross-team test

Our tester and system are public and ready for the Phase 3 cross-team check, but no Team 15 endpoint or partner report was provided. Self-testing is recorded above and is not substituted for the two required partner directions.

- Team 16 tester -> Team 15 service | Date: not run | Run/passed: unavailable | Code/component/system coverage: unavailable | Owner/action: Team 16 obtains the partner system URL, approves it, runs our full suite and retains the report.
- Team 15 tester -> Team 16 service | Date: not run | Run/passed: unavailable | Code/component/system coverage: unavailable | Owner/action: Team 15 runs their full suite against our registered /system URL and returns the report.

## Q6.2 Specification issues discovered

Issue: Phase 2 requires owner/name but shows an ownerless example, and its prose does not define exact changed-file keys, classification precedence, rename behavior or the component inventory used for coverage. Effect: independent services/testers could reject each other's inputs or interpret correct changes differently; a numeric component percentage would be unsupported. Team 16's implementation uses the documented rules and reports unknown component coverage as null rather than inventing a shared inventory. Pod plan: review docs/shared-spec.md with Team 15 before recording cross-team results, approve a common version/date/channel, and resolve mapping correctness/review-record access before their Phase 4/5 milestones; no completed agreement is claimed.

## Q7.1 What changed and what remains incomplete

Changed since the Phase 2 design:

- REQ-01 / AC-01: implemented full-SHA version resolution and deterministic classified additions, modifications, deletions and renames.
- REQ-04 / initial AC-06: implemented immutable R2 result JSON and retrieval across independent runs.
- REQ-05 / AC-07, ordinary AC-08: implemented invalid-input, missing-resource and explicit operational failure behavior.
- REQ-07 / AC-10: deployed system/tester interfaces with repeatability and immutable suite reports.
- REQ-06 / AC-09: constrained repository access to read-only HTTPS without executing repository code.

Remaining planned scope:

- REQ-02 / AC-02, AC-03: missing/stale documentation mapping and investigation of incorrect co-changes (Phase 4).
- REQ-03 / AC-04, AC-05: findings, initial PENDING_REVIEW state and authorized human decisions (Phases 4/5).
- REQ-05 / mapping-related AC-08: unsupported mapped-file and invalid-mapping checks (Phase 4).
- REQ-04,06 / complete AC-05, AC-06, AC-09: durable linked human review, complete operational inspections and explicit lifecycle evidence (Phase 5, with Phase 3 initial persistence checks).
- REQ-07 / cross-team readiness: partner runs, shared-spec clarifications and component coverage agreement (before Phase 3 submission).

## Q7.2 Known limitations and defects

| ID | Limitation / affected requirement | Severity | Workaround | Target |
| --- | --- | --- | --- | --- |
| LIM-01 | No documentation mapping/findings; REQ-02,03 | medium | Treat this as change evidence; review documentation manually | Phase 4 |
| LIM-02 | No authorized review workflow/GitHub summaries; REQ-03,06 | medium | Do not submit review decisions to this API | Phase 5 |
| LIM-03 | GitHub quota/access can still prevent cold commit metadata lookup; REQ-05,07 | medium | Reuse full-SHA cache, retry later; add a scoped read-only credential if approved | Phase 4 |
| LIM-04 | Fewer than 300 changed files; forward ancestor comparisons only; REQ-01,05 | medium | Use small fixtures or a smaller forward commit range; inspect saved ERROR/skipped details | Phase 4 |
| LIM-05 | Per-session code and pod component coverage unavailable; REQ-07 | low | Use null with basis; inspect local coverage separately; agree component rules | Phase 4 |
| LIM-06 | No reviewer authentication, per-user rate limit, retention scheduler or automatic alert delivery; public evidence/sessions can grow | medium | Use only public/synthetic repositories; owner monitors metrics/storage; no sensitive inputs | Phase 4/5 |
| LIM-07 | A process crash during a tester run may leave a running session/report unavailable | medium | Use a fresh session after investigation; never resend the old run | Phase 4 |
| LIM-08 | Classification is file-path based; abbreviated refs/visibility cached 10 minutes | low | Use full SHAs and supported paths; do not treat category as semantic proof | Phase 4 |

## Q7.3 Adjustments to the next milestone

The Phase 4 milestone still targets explicit source-to-document mappings, missing/stale warnings and controlled correct/incorrect co-change fixtures. Before adding that detector, the pod should finalize shared field names, classification/base/rename rules, fixture oracles and a numeric component coverage basis. Priority Risk 1 (mapping may suppress incorrect documentation) remains unresolved and needs labelled cases and a pod decision; Priority Risk 2 (authorized review/evidence integration) is only partly reduced by successful immutable analysis storage, because review records do not exist yet. Newly demonstrated risks are Worker-vs-Node compatibility and unauthenticated GitHub egress quotas; manual redirect handling, hosted verification and metadata caching reduce these without changing shared functional scope.

## Q8.1 Actual GenAI use

For Anish Paspuleti, Codex was delegated repository scaffolding, analyzer/tester implementation, tests, deployment, model drafting and this writeup; no Claude usage is evidenced in this session, although Phase 2 anticipated both tools. Verification included JavaScript/TypeScript/lint/schema checks, 32 local tests, GitHub CI and actual hosted requests, while human review by Anish and teammates remains a submission responsibility rather than a completed event claimed here. A concrete correction was the generated redirect:error setting: Node tests accepted it, the Worker rejected it, local runtime diagnostics identified the incompatibility, and manual redirect handling was implemented and retested. The work used bounded increments, independent fixture expectations, explicit limitations and protected credentials, consistent with Phase 2's engineering-assistance and no-runtime-LLM approach; implementation and deployment were delegated broadly, and independent human review remains pending.

Other teammates: no individual use/verification records were supplied. Each teammate must add their own truthful 3-4 sentences if the team submission requires them; do not copy Anish's record as theirs.

## Q9 References

[1] European Parliament and Council of the European Union. "Regulation (EU) 2024/1689 (Artificial Intelligence Act)." June 13, 2024. https://eur-lex.europa.eu/eli/reg/2024/1689/oj. Accessed: 2026-10-16.

[2] GitHub. "REST API endpoints for commits: Get a commit; Compare two commits." GitHub REST API documentation. https://docs.github.com/en/rest/commits/commits. Accessed: 2026-10-16.

[3] Cloudflare. "vinext." Project README; implementation uses 1.0.0-beta.5. https://github.com/cloudflare/vinext. Accessed: 2026-10-16.

[4] GitHub. "Rate limits for the REST API." GitHub Docs. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api. Accessed: 2026-10-16.

[5] Cloudflare. "Cloudflare D1: Overview." https://developers.cloudflare.com/d1/. Accessed: 2026-10-16.

[6] Cloudflare. "R2 Workers API reference." Sections: put/get and conditional operations. https://developers.cloudflare.com/r2/api/workers/workers-api-reference/. Accessed: 2026-10-16.

[7] OpenAPI Initiative. "OpenAPI Specification v3.1.1." https://spec.openapis.org/oas/v3.1.1.html. Accessed: 2026-10-16.

[8] Node.js contributors. "Test runner." Node.js 24 documentation, collecting code coverage. https://nodejs.org/download/release/v24.16.0/docs/api/test.html. Accessed: 2026-10-16.
