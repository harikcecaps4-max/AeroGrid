# AeroGrid: working agreement (read this at the start of EVERY session)

## 0. How this file is used
- This file defines HOW we work: daily routine, deadlines, time budgets, quality bar, definition of done.
- WHAT we build and the stack are in `docs/PROJECT_BRIEF.md` (if missing, the stack is: React+Vite+Leaflet in `client/`, Node 24+Express in `functions/aerogrid_api/` on Zoho Catalyst, PostgreSQL+PostGIS 3.6 on Neon).
- Project name is always "AeroGrid". Never rename it.
- Every session: read this file, `docs/PROGRESS.md` and `docs/BACKLOG.md`, then follow section 3 (morning ritual).

## 1. Mission and final achievement
Mission: the best AeroGrid prototype in the regional-airstrip decision-support space. It answers "Is this airstrip a good place to deploy this aircraft fleet, and why?" for eVTOL/STOL/charter/cargo/air-ambulance operators.

Final achievement (definition of done for the whole project), all of these:
1. Live, deployed app: React client on Catalyst Slate + API on Catalyst + Neon PostGIS, in the Production environment.
2. 300+ airstrips loaded through a validated, re-runnable import pipeline from public sources, each with a source field and a data-quality flag.
3. Working modules: runway/physical specs, catchment (20/50 km), last-mile access, connectivity, terrain/obstacle risk, fleet-fit. Every score is explainable (breakdown + plain-English "why").
4. JWT auth with roles (admin, analyst, viewer); protected routes.
5. Tests pass, lint is clean, `npm audit` has no high/critical issues.
6. Docs complete: README, architecture diagram, ER diagram, API reference, data dictionary, indexing proof (EXPLAIN ANALYZE before/after), deployment guide.
7. A rehearsed 3-minute demo and a viva-prep file (`docs/VIVA_PREP.md`) with likely questions and answers about every design decision.
Rule: a smaller finished project beats a larger broken one. If time is short, cut features, never quality items.

## 2. Deadline and clock
- Project clock started 2026-10-19 (20 days). Assumed deadline: **Saturday 2026-11-07** [EDIT if different].
- Today in the plan = the date in `docs/PROGRESS.md`. Days remaining must be stated at the top of every morning plan.
- Feature freeze: Wed 2026-11-04, end of day. After that: tests, security, docs, demo only.
- Nov 6 is the final deploy and rehearsal day. Nov 7 is a buffer for bug fixes and submission only.
- Daily capacity: [3-4 hours on weekdays, 5 on weekends] [EDIT]. At the start of each day I will tell you how many hours I really have; fit the plan to that, not to the template.

## 3. Daily ritual

### Morning (when I say "start today")
1. State: date, days left, hours I have today.
2. List today's tasks. Each task has: a time budget, a "done when" test, and the files it touches.
3. Flag the single riskiest task and propose a fallback if it overruns.
4. Ask at most ONE clarifying question, only if truly blocked. Otherwise state assumptions and go.
5. Wait for my "go".

### During the day
- One task at a time, in the planned order. Small steps. After each task: what changed, which files, how I test it. Then wait for my review.
- If a task passes 1.5x its time budget: STOP, report why, and propose (a) a smaller version, (b) a different approach, or (c) cutting it. I decide.
- Never start unapproved features. New ideas go to `docs/BACKLOG.md`.

### Evening (when I say "end of day")
Produce, in this order, and append it to `docs/PROGRESS.md`:
1. **Checklist** for today: each item as [x] done, [~] partly, [ ] not done, [!] blocked, with a one-line reason for anything not [x].
2. **What changed:** files created/edited, migrations added, endpoints added.
3. **Time:** planned vs actual per task.
4. **Risks and debts:** anything hacky, untested or temporary.
5. **Tomorrow's plan** in the morning-ritual format, adjusted for what slipped.
6. **Three feature suggestions** (see section 7).
7. **Updated "Current state"** (section 11).
Do not commit or push. I will review the diff and commit.

## 4. Time-box and priority rules
- Priorities: MUST (final achievement items), SHOULD (strong differentiators), COULD (polish). Build in that order.
- If a day slips by more than half, re-plan the remaining days and say which COULD/SHOULD items are cut. Never cut: tests, security, docs, deploy.
- Prefer boring, proven solutions over clever ones. No experiments in the last 5 days.

## 5. Day-wise plan (Oct 25 to Nov 7) [times are budgets in hours]
- **Sun Oct 25:** finish API: `/health`, `/api/airstrips` (GeoJSON, nearest airport, feasibility score) 1.0; deploy function, set `DATABASE_URL` in Catalyst 0.5; Leaflet map with score-coloured markers + legend 2.0; click-to-open detail panel with score breakdown 1.0; ESLint + Prettier 0.5. Done when: deployed map shows 12 coloured markers and the panel works.
- **Mon Oct 26:** JWT auth + RBAC: migration 003 (users seed), bcrypt, login endpoint, auth middleware, role guard, login screen, protected routes 3.5. Done when: viewer cannot call admin routes (tested).
- **Tue Oct 27:** data pipeline 1: import script for real airstrips (public CSV sources), staging table, validation rules, reject log, source + quality flag columns 4.0. Done when: re-running the import does not duplicate rows.
- **Wed Oct 28:** data pipeline 2: scale to 300+ rows, data-quality report, EXPLAIN ANALYZE before/after GiST index with screenshots saved to `docs/` 3.5. Done when: indexing proof exists and the map handles 300+ markers smoothly (clustering if needed).
- **Thu Oct 29:** catchment: `population_centres` table (migration), 20/50 km `ST_DWithin` totals, nearest tertiary hospital, show in panel 4.0.
- **Fri Oct 30:** fleet-fit: aircraft profile selector; re-score all strips (min runway, charging for eVTOL, range to nearest hub); legend updates 4.0.
- **Sat Oct 31:** filters (state, surface, ownership, min runway, night landing) + search by name; compare two strips side by side 5.0.
- **Sun Nov 1:** last-mile access (access_points data, drive-distance estimate method documented) + plain-English "why this score" text generated from the breakdown 4.0.
- **Mon Nov 2:** terrain/obstacle risk fields with a score penalty; admin data-quality page 3.5.
- **Tue Nov 3:** exportable airstrip assessment report (PDF or print view) 3.5.
- **Wed Nov 4:** FEATURE FREEZE. Unit + API tests, lint at zero warnings, `npm audit`, helmet + rate limiting, loading/empty/error states, accessibility pass 4.0.
- **Thu Nov 5:** docs: README, architecture + ER diagrams, API reference, data dictionary, deployment guide, `VIVA_PREP.md` 4.0.
- **Fri Nov 6:** Production deploy, full bug bash on the deployed app, demo rehearsal x3 with timing 3.0.
- **Sat Nov 7:** buffer: bug fixes only, final checks, submit.

## 6. Quality bar (my standards) [EDIT]
Code
- ESLint: zero errors and zero warnings. Prettier-formatted. No unused code, no commented-out blocks, no stray `console.log` (use the structured logger).
- Functions short (aim under 40 lines), single purpose, clear names. Constants and score weights live in one config file, not scattered magic numbers.
- Comments explain why, not what. JSDoc on exported functions.
- Config via env vars, validated at startup; the app fails fast with a clear message if one is missing.

API
- Consistent REST naming, correct status codes (200/201/400/401/403/404/500), JSON error shape `{ "error": "..." }`.
- Validate all input. Paginate any list endpoint that can exceed 100 rows. Restrict CORS to the real client origin in production. Rate-limit auth routes.
- Structured JSON logs (method, path, status, ms, no secrets/PII). Central error middleware; never leak stack traces.

Database
- 3NF, foreign keys, NOT NULL, UNIQUE and CHECK constraints, GiST indexes on geometry. Every index justified by an EXPLAIN ANALYZE.
- Numbered migrations only, idempotent where practical, never editing applied ones. Parameterised queries only.

Security
- Secrets only in env vars, never in the repo, logs or prompts. bcrypt cost 12+, short-lived JWTs with a role claim, least-privilege roles, `npm audit` clean of high/critical.

Frontend
- Responsive; loading, empty and error states for every data call; API base URL from `VITE_API_URL`. Colour is never the only signal (show the score number/label too). Data marked "sample" is visibly labelled.

Testing
- `node:test` unit tests for scoring (every branch), API smoke tests for every route including auth failures. Tests must pass before any day is marked done.

Git
- Small commits, one logical change each, imperative messages ("Add catchment query"). I commit and push; you never do.

Docs
- Every new feature updates the README or API reference the same day.

## 7. Daily feature suggestion protocol
Every evening, propose exactly 3 new feature ideas that fit the mission, ranked. For each: one-line description, user value, effort in hours, risk, and which module it extends. Do not repeat items already in the backlog. At most ONE gets built the next day, only if I approve and only if it fits the time budget. The rest go to `docs/BACKLOG.md`. Ideas that make AeroGrid stand out (consider these first): explainable scoring with adjustable weights, fleet-aware re-scoring, data provenance and quality badges per airstrip, emergency/air-ambulance coverage view, and a "recommend the best 3 strips for this aircraft in this state" action.

## 8. Hard rules
1. Never hardcode, print, log or commit secrets (`DATABASE_URL`, JWT secret). Provide `.env.example` with placeholders; keep `.env` in `.gitignore`.
2. Never run `git commit`, `git push` or `catalyst deploy`. I do those after reviewing the diff.
3. Ask before any command that installs packages, deletes files, or connects to the database. Never run destructive SQL.
4. Seed and test data are ILLUSTRATIVE. Never present them as verified facts. Real data must carry a source and a quality flag.
5. Do not change Slate settings, the Catalyst project, or the Neon project.
6. Do not add large dependencies without explaining why and getting approval.
7. If a requirement is unclear or my instruction conflicts with this file, say so and ask one question rather than guessing.

## 9. Communication style
- Concise. Lead with the result, then the detail. Use short steps I can test.
- Teach as you go: after each task give me a 2-3 sentence "how to explain this in a viva" note and add it to `docs/VIVA_PREP.md`.
- Be honest about uncertainty, hacks, and anything you did not test. No claiming "done" without showing how it was verified.

## 10. Evaluation alignment
The project is evaluated on Advanced Programming and Data Engineering. Treat these as graded: spatial SQL (ST_DWithin, ST_Distance, KNN `<->`), GiST indexing with proof, 3NF schema, ETL/import pipeline with validation, JWT + RBAC, structured logging and error middleware, clean architecture, tests, and documentation. (I will upload the rubric documents; when they exist in `docs/`, re-check this list against them and report gaps.)

## 11. Current state (update every evening)
- As of 2026-10-24: repo, Slate deploy of `client/` (default Vite template), Neon + PostGIS 3.6, migrations 001 and 002 applied (12 sample airstrips, 7 airports, 3 aircraft profiles), Catalyst CLI initialised, function scaffold `functions/aerogrid_api` created (API code not written yet), Antigravity installed.
- Next task: Sun Oct 25 plan above.
