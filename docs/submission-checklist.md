# Remaining human/pod steps before submission

The code, public repository and both service base URLs are delivered. Do not claim the following external work is complete until it occurs.

1. Review `docs/phase3-writeup.md` and the code. This is a substantial GenAI-assisted implementation; understand and confirm the choices and limitations.
2. Paste `docs/registry-entry.csv` into Team 16's actual class registry row. The registry URL was not supplied, so no registry edit was performed.
3. Agree on `docs/shared-spec.md` clarifications and the component-coverage inventory with Team 15. Record the date/channel and update both teams' shared specification consistently.
4. Obtain Team 15's system/tester URLs. Add their exact system base to APPROVED_TARGETS, run our tester against it, and have them run their tester against https://documentation-tracker-ani131.hazyrobin67.chatgpt.site/system. Save both reports and update Q6.1 with actual results and coverage.
5. Add truthful GenAI-use statements for teammates other than Anish, then update Q8.1.
6. Submit the report and required links through the course submission system. No LMS submission was performed.

## Runtime administration

Hosting project ID: appgprj_6ad2889ca5048191b9d7bb288cd9fc00. The site has public access. DB and BUCKET are platform-managed bindings. RELEASE_SHA identifies the deployed source; APPROVED_TARGETS is a comma-separated exact HTTPS allowlist. Never place a personal repository-write token in the runtime. Provider account costs/quotas and exact storage region were not exposed by the available tools.

Release procedure: run checks/tests and build, synchronize exact source to the existing Sites project, package its dist output plus schema migrations, save a version, set RELEASE_SHA to that source commit, and deploy the saved version. Push the same source to GitHub and check CI. The implementation source and release SHA are immutable references; later documentation-only commits can record the evidence for that deployed release.
