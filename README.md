# AeroGrid Intelligence

> **DECISION SUPPORT ONLY. NOT FOR OPERATIONAL OR DISPATCH USE.** Evaluations use preliminary geometric, surface and ISA density-altitude approximations and may include unverified or placeholder records. Always verify against official AIP/DGCA aerodrome charts, site surveys and the manufacturer's Aircraft Flight Manual (AFM/POH) before flight operations.

A spatial data analytics and business-development platform that answers one question for an aircraft operator: **"Is this airstrip a good place to deploy this fleet, and why?"**

| | |
|---|---|
| **Live app** | https://aero-cpfxbilr.onslate.in/ |
| **Live API** | https://aerogrid-60086051931.development.catalystserverless.in/server/aerogrid_api/ |
| **Repository** | https://github.com/harikcecaps4-max/AeroGrid |
| **Author** | Harikrishna C |
| **Status** | Working prototype |

<img width="1913" height="984" alt="Screenshot 2026-11-28 at 3 34 33 AM" src="https://github.com/user-attachments/assets/2e1b5a58-c2ad-4763-b613-7b7a6e58f686" />

## Table of contents
1. [Problem statement](#problem-statement)
2. [Who is affected](#who-is-affected)
3. [Proposed solution](#proposed-solution)
4. [How it is different](#how-it-is-different)
5. [Modules](#modules)
6. [Features](#features)
7. [Architecture](#architecture)
8. [Tech stack](#tech-stack)
9. [Repository structure](#repository-structure)
10. [Database design](#database-design)
11. [Getting started (macOS)](#getting-started-macos)
12. [API reference](#api-reference)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Challenges and how I solved them](#challenges-and-how-i-solved-them)
16. [Roadmap](#roadmap)
17. [Credits](#credits)

## Problem statement
Operators of eVTOL air taxis, STOL aircraft, charter, cargo and air-ambulance services have no reliable, comparable way to decide which regional airstrip to deploy a fleet at. Records on hundreds of underutilised micro-airstrips (paved, unpaved, private, municipal, state-owned) sit in fragmented, offline and inconsistent formats, so every feasibility study starts from scratch.

## Who is affected
- Fleet operators choosing bases and routes
- State aviation departments deciding which strips to revive
- Air-ambulance coordinators who need to know which strip is closest to a tertiary hospital

## Proposed solution
AeroGrid digitises airstrip records into a PostGIS-backed GIS. It indexes 300+ regional micro-airstrips and assesses runway feasibility, terrain risk, catchment population and last-mile ground access for a given aircraft. It is **not** a flight-booking app.

## How it is different
| Existing tools | AeroGrid |
|---|---|
| Built for navigating (route and airport data) | Built for operators and eVTOL companies making deployment decisions |
| Static airport data and PDFs | Queryable spatial database with comparable fields |
| Airport-centric | Catchment-centric: who can the strip serve, and how fast can they reach it |
| Same view for every aircraft | Aircraft-aware: eVTOL, STOL and turboprop fleets are judged by their own requirements |

**Target users**
- **Primary:** fleet operators and planners at eVTOL and air-taxi, regional charter, cargo and air-ambulance companies
- **Secondary:** state civil aviation departments, airport authorities, disaster-management agencies and infrastructure consultants

## Modules
| Module | What it stores and analyses |
|---|---|
| 1. Physical and runway specs | Runway dimensions, elevation, surface (asphalt, gravel, grass), fuel availability, eVTOL charging stations, night-landing capability |
| 2. Terrain and obstacle risk | Distance to high-voltage lines, cell towers, hill hazards, land-encroachment level |
| 3. Catchment demographics | Population within 20 km and 50 km, distance to tertiary hospitals, local activity index |
| 4. Last-mile access | Driving distance and travel time from the airstrip to the target city or district centre |
| 5. Access points and fleet connectivity | Distance to nearby airstrips and airports that a fleet can link, using spatial distance queries |
| 6. Fleet-fit analysis | Decision engine live (evaluate, rank, compare); deeper payload, range, fuel and routing factors are planned |

## Features
- Airstrip registry with runways, access points and distance to nearby airports (PostGIS)
- Interactive aeronautical map with marker clustering and radius search
- Decision engine with evaluate, rank and compare endpoints; unknown data is treated as unknown, never as zero
- Asset management per airstrip with status updates
- Fleet deployments, analytics, simulation dossiers and reports
- Authentication: JWT with role-based access (RBAC) and Google sign-in
- Light and dark themes with an automated contrast audit, plus high-contrast and reduced-motion support
- Data integrity: bcrypt password hashing, SHA-256 row checksums, audit hash chain, database constraints
- Rate limiting, structured JSON logging and centralised error middleware

# Airstrip map
<img width="1911" height="983" alt="Screenshot 2026-11-28 at 3 37 55 AM" src="https://github.com/user-attachments/assets/acca5d66-1f39-454f-b97a-45d3f3e0d13d" />

# Fleet deployments
<img width="1912" height="983" alt="Screenshot 2026-11-28 at 3 38 26 AM" src="https://github.com/user-attachments/assets/f3b69787-a78d-4c9a-8b00-869c3d37588b" />

# Google sign-in button
<img width="1351" height="589" alt="image" src="https://github.com/user-attachments/assets/373a4c53-de1d-4984-804a-c4dac2738dc0" />

## Architecture
```
React + Vite  (Catalyst Slate, auto-deploys from main)
      |  HTTPS / JSON
Express API   (Catalyst serverless function: aerogrid_api, Node 24)
      |  SQL (pooled)
PostgreSQL 18 + PostGIS 3.6  (Neon)
```

Design notes:
- Shared server code is packaged for the Catalyst function, so the decision engine exists once and is used by both the local server and `functions/aerogrid_api`.
- The frontend sends `text/plain` request bodies with the token in the body, which avoids a CORS preflight on Catalyst. The API accepts JSON, URL-encoded and text bodies.
- Routes are mounted both under `/api` and at the root, so the same API works behind Catalyst's function path and locally.
- `spatialRoutes` are mounted before `airstripsRoutes` so `/airstrips/radius` is not captured by `/airstrips/:id`.

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Leaflet + OpenStreetMap tiles with marker clustering, React Router, Google OAuth (`@react-oauth/google`) |
| Backend | Node.js, Express, JWT, Zod validation, `google-auth-library` |
| Database | PostgreSQL 18, PostGIS 3.6, btree_gist |
| Hosting | Zoho Catalyst (Slate + Serverless), Neon |
| Tooling | npm, npx, ESLint, Node test runner, pgAdmin 4, Catalyst CLI, Git/GitHub |

## Repository structure
```
client/        React + Vite frontend
server/        Express app (index.js, src/)
functions/     Catalyst function entry (aerogrid_api)
db/            migrations, migrate.js, seed.js, data_quality.sql, db.test.js
docs/          BACKLOG, DESIGN, PROGRESS, THEMING_AND_CONTRAST, VIVA_PREP, WORKING_AGREEMENT
design/        archived Stitch design specifications
scripts/       smoke-live.js (post-deploy check)
DEPLOY.md      deployment guide
catalyst.json  Catalyst project configuration
```

## Database design
- 3NF throughout, 5NF where a join dependency required it (`organization_relationships`, `request_aircraft`, `request_airstrips`)
- Spatial queries use `ST_DWithin` and `ST_Distance` with GiST indexes
- Integrity: foreign keys (including composite FKs from `evaluations`), CHECK constraints, unique email, a `btree_gist` exclusion constraint that prevents overlapping relationships, `updated_at` triggers
- Security and audit: bcrypt check constraint, SHA-256 row checksums, audit hash chain, `refresh_tokens`
- Evaluations are append-only, and engine configs are versioned, with provenance recorded on each result
- Airstrips are archived through `data_status`, never hard-deleted
- Migrations 001-014 are applied on Neon: 008 normalises the core schema, 009 adds integrity and audit, 010 provenance and decisions, 011 organisations and requests, 012 Neon production hardening, 013 Google OAuth, 014 dedupe and enrichment
  
# ER diagram

<img width="1371" height="955" alt="Screenshot 2026-11-28 at 4 07 31 AM" src="https://github.com/user-attachments/assets/ca4fba7f-f9ec-4a32-90d2-c0fd7ae9a83c" />

## Getting started (macOS)
Prerequisites: Node.js, npm, Git, and a Neon Postgres database with PostGIS enabled.

```bash
git clone https://github.com/harikcecaps4-max/AeroGrid.git
cd AeroGrid
npm install
cd client && npm install && cd ..

cp .env.example .env            # fill in your values, never commit .env

npm run migrate:dry-run         # preview migrations
npm run migrate                 # apply migrations
npm run migrate:status          # check applied migrations
npm run seed                    # load sample data

npm run dev                     # start the API locally
cd client && npm run dev        # start the frontend (second terminal)
```

### Environment variables
| Name | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon connection string |
| `JWT_SECRET` | server | Signs access tokens (the app refuses to start without it) |
| `GOOGLE_CLIENT_ID` | server | Verifies Google sign-in tokens |
| `VITE_API_BASE` | client | Base URL of the deployed `aerogrid_api` function (defaults to `/api`) |
| `VITE_GOOGLE_CLIENT_ID` | client | Google OAuth 2.0 Web Client ID |
| `VITE_ENABLE_DEMO` | client | Enables demo login in dev builds only |

Only `.env.example` templates are committed.

## API reference
Base URL: `https://aerogrid-60086051931.development.catalystserverless.in/server/aerogrid_api/`

All endpoints are served under `/api/*`, with matching root fallback paths for Catalyst serverless routing. Decision, airstrip, spatial and validation JSON responses include the mandatory `caveat` disclaimer shown at the top of this README.

| Method and path | Auth | Description | Request | Response highlights |
|---|---|---|---|---|
| `GET /api/health` | Public | Service and database health check (`/health` alias also mounted) | None | Health status payload |
| `POST /api/auth/register` | Public (rate limited) | Register a user | credentials | token and user |
| `POST /api/auth/login` | Public (rate limited) | Log in | credentials | token and user |
| `POST /api/auth/google` | Public (rate limited) | Google sign-in | Google ID token | token and user |
| `PATCH /api/users/:id/role` | JWT (`confirm` required role) | Change a user's role | role | updated user |
| `GET /api/states` | Public | List states | None | states |
| `GET /api/cities` | Public | List cities | None | cities |
| `GET /api/aircraft` | JWT (viewer or above) | List normalised aircraft performance profiles | None | `{ count, aircraft, caveat }` |
| `POST /api/evaluate` | JWT | Evaluate one aircraft on one airstrip | `{ aircraftId, airstripId }` | `{ aircraft, airstrip, verdict, score, gates, factors, warnings, caveat }` |
| `POST /api/rank` | JWT | Rank airstrips for an aircraft with optional filters | `{ aircraftId, filters?: { state, surface, ownership, minRunwayLengthM, includeNotViable, onlyViable } }` | `{ aircraft, total_evaluated, viable_count, conditional_count, not_viable_count, results, filters, caveat }` |
| `POST /api/compare` | JWT | Compare 2 to 3 airstrips for one aircraft | `{ aircraftId, airstripIds: [id1, id2, ...] }` | `{ aircraft, comparisons, recommended_airstrip_id, summary, matrix, caveat }` |
| `GET /api/airstrips` | `confirm` | List airstrips as a GeoJSON `FeatureCollection` | Query: `state`, `surface`, `min_score`, `political_severity`, `search`, `aircraft_id` | `{ type: "FeatureCollection", count, features, caveat }` (`properties.decision` added when `aircraft_id` is set) |
| `GET /api/airstrips/:id` | `confirm` | Single airstrip as a GeoJSON `Feature` | Path `id`; optional `aircraft_id` | Feature plus `caveat` |
| `GET /api/airstrips/radius` | `confirm` | Airstrips within a radius of coordinates | Query: `lat`, `lng` (required), `radius_km` (default `150`) | `{ center, radius_km, count, airstrips, caveat }` |
| `GET /api/airstrips/:airstripId/assets` | JWT | List assets at an airstrip | Path `airstripId` | assets |
| `POST /api/airstrips/:airstripId/assets` | JWT | Add an asset | asset details | created asset |
| `PATCH /api/assets/:id/status` | JWT | Update asset status | status | updated asset |

### Sample payloads
```json
// POST /api/evaluate
{ "aircraftId": 3, "airstripId": 1 }

// POST /api/rank
{
  "aircraftId": 5,
  "filters": {
    "state": "Karnataka",
    "surface": "asphalt",
    "minRunwayLengthM": 1200,
    "includeNotViable": false
  }
}

// POST /api/compare
{ "aircraftId": 1, "airstripIds": [1, 2, 5] }
```

## Testing
```bash
npm test                  # database, env, geo, decision engine and route tests
npm run test:db           # database integrity tests
npm run test:decision     # decision engine tests
npm run test:api          # decision route tests

psql "$DATABASE_URL" -f db/data_quality.sql   # missing, duplicate and invalid record checks
node scripts/smoke-live.js                    # live smoke test against the deployed API

cd client
npm test                  # theme tests
npm run check:contrast    # contrast gate
npm run audit:theme       # page-level theme audit
npm run lint              # ESLint
```

## Deployment
- **Frontend:** Catalyst Slate deploys `/client` from `main` with auto-deploy
- **Backend:** Catalyst serverless function `aerogrid_api` (Node 24, Advanced I/O)
- **Database:** Neon (Singapore region, Postgres 18), `rehearsal` branch, with `production` and two backup branches kept as restore points
- Full steps are in [DEPLOY.md](DEPLOY.md)

# Catalyst function

<img width="1910" height="983" alt="Screenshot 2026-11-28 at 4 14 57 AM" src="https://github.com/user-attachments/assets/6e50e214-438d-470b-a87c-bd21ae4dc592" />

## Challenges and how I solved them
| Challenge | Solution | Commit |
|---|---|---|
| Browser CORS preflight blocked requests to the Catalyst function | Sent `text/plain` bodies with the token in the body so no preflight is triggered | `0690d9a` |
| Server exited when started directly, and `.env` was not loaded locally | Kept the process alive and loaded `.env` on local runs | `3dd5b79` |
| Shared server code was not available inside the Catalyst function | Packaged it for Catalyst, shared the decision engine without duplication, and wrote DEPLOY.md | `bc20eed`, `f2a63c7` |
| A silent database fallback hid real failures | Removed it, added a `data_source` field, and guarded an unconfigured DB pool | `dd428d6`, `b328bd3` |
| Default JWT secret and weak auth middleware | Removed the default secret, validated env at startup, hardened the middleware | `fac8db1` |
| Zod v4 changed its error shape and broke validation | Updated `validateRequest` to read the new issues array | `7373b3a` |
| `spatialRoutes` were shadowed by `airstripsRoutes` | Mounted them in the correct order | `b328bd3` |
| Duplicate airstrips and scoring logic in two places | Deduplicated the data and kept a single scoring source | `5fa3da8` |
| Missing utility fields counted as zero in the decision engine | Treated null as unknown | `78a7c33` |
| Migrations drifted from the live Neon schema | Restored real migrations 008-012, aligned the decision data service with the live schema, added a live smoke test | `855c2ec` |
| Weak integrity and slow queries | Added GiST and FK indexes, CHECK constraints and unique email | `68e01d5` |
| Horizontal overflow on mobile | Tightened flex/grid containment | `4cb8d41`, `2193375` |
| Poor contrast and accessibility across themes | Added a contrast gate, an automated theme audit, forced-colors and reduced-motion support | `a9f5155` and related commits |
| Neon free plan keeps only 6 hours of history | Kept never-expiring backup branches (`backup-before-migrations`, `backup-before-google-auth`) and applied migrations on a separate `rehearsal` branch first | n/a |

## Roadmap
- Aircraft factors: payload, passenger capacity, range, fuel or charging, and routing
- Further items are in [docs/BACKLOG.md](docs/BACKLOG.md)

## Credits
- **Author:** Harikrishna C
- **Instructor:** `Pranav Huchche , Shubham Sagar , Adarsh Singh Chauhan ` for guiding and trusting on me.  
- **Course:** `Advanced Programming and Data Engineering`
- **Special thanks:** Zoho Catalyst for the hosting that put AeroGrid live
- Built with Zoho Catalyst , React, Express, PostgreSQL/PostGIS , Neon, Leaflet and OpenStreetMap contributors
- UI design explored with Stitch (specifications archived in `design/stitch`)

