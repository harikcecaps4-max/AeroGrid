# AeroGrid

# Problem Statement & Ideation
Operators of eVTOL air taxis, STOL aircraft, charter, cargo and air-ambulance services have no reliable, comparable way to decide which regional airstrip to deploy a fleet at. Records on hundreds of underutilized micro-airstrips (paved, unpaved, private, municipal, state-owned) sit in fragmented, offline and inconsistent formats, so every feasibility study starts from scratch.

# Who is affected 
Fleet operators choosing bases and routes, state aviation departments deciding which strips to revive, and air-ambulance coordinators who need to know which strip is closest to a tertiary hospital.

# Proposed solution
AeroGrid Intelligence is a spatial data analytics and business-development platform. It digitizes airstrip records into a PostGIS-backed GIS and answers one question for an operator: "Is this airstrip a good place to deploy this aircraft fleet, and why?".

# How it is different

| **Existing tools** | **AeroGrid** |
| :--- | :---|
| Built for navigating (route and airport data) | Built for operators and eVTOL companies making deployment decisions    |
| Static airport data and PDFs   | Queryable spatial database with comparable fields   |
| Airport-centric     | Catchment-centric: who can the strip serve, and how fast can they reach it |
| Same view for every aircraft  | Aircraft-aware: eVTOL, STOL and turboprop fleets are judged by their own requirements |

# Target users.

* **Primary:** fleet operators and planners at eVTOL/air-taxi, regional charter, cargo and air-ambulance companies.
* **Secondary:** state civil aviation departments, airport authorities, disaster-management agencies and infrastructure consultants.

| **Module** | **What it stores and analyses**  |                                                                       
| :--- | :--- |
| 1. Physical and runway specs            | Runway dimensions, elevation, surface (asphalt, gravel, grass) , fuel availability , charging stations for eVTOL , night-landing capability |
| 2. Terrain and obstacle risk | Distance to high-voltage lines, cell towers, hill hazards, land-encroachment level |
| 3. Catchment demographics   | Population within 20 km and 50 km, distance to tertiary hospitals, local activity index |
| 4. Last-mile access  | Driving distance and travel time from the airstrip to the target city or district centre |
| 5. Access points and fleet connectivity | Distance to nearby airstrips and airports that a fleet can link, using spatial distance queries |
| 6. Fleet-fit analysis (next phase) | Compatibility of an aircraft type with an airstrip, based on payload, passenger capacity, range, fuel or charging, and routing |

# End goal definition

Prototype

# Tech stack and architecture

| **Tech**    | **choice**  |
| ------ | --- |
| Frontend    | React.js |
| Map | Leaflet + OpenStreetMap tiles |
| Backend  | Node.js + Express |
| API hosting | Zoho Catalyst serverless functions |
| Database | PostgreSQL + PostGIS on Neon |
| Tooling | npm, npx, Git/GitHub, pgAdmin 4, Catalyst CLI |

# API Endpoints

All endpoints are served under `/api/*` (and matching root fallback paths for Zoho Catalyst serverless routing). Decision, airstrip, spatial, and validation JSON responses include the mandatory `caveat` disclaimer:

> *DECISION SUPPORT ONLY — NOT FOR OPERATIONAL OR DISPATCH USE. Evaluations use preliminary geometric, surface, and ISA density-altitude approximations and may include unverified or placeholder records. Always verify against official AIP/DGCA aerodrome charts, site surveys, and the manufacturer's Aircraft Flight Manual (AFM/POH) before flight operations.*

| Method & Path | Description | Key Parameters / Request Body | Response Highlights |
| --- | --- | --- | --- |
| `GET /api/aircraft` | List normalized aircraft performance profiles used by the decision engine | None | `{ count, aircraft, caveat }` (`PLACEHOLDER` source notice) |
| `POST /api/evaluate` | Evaluate suitability of one aircraft profile on one airstrip | `{ aircraftId, airstripId }` (positive integer IDs) | `{ aircraft, airstrip, verdict, score, gates, factors, warnings, caveat }` |
| `POST /api/rank` | Rank airstrips for a selected aircraft with optional filters | `{ aircraftId, filters?: { state, surface, ownership, minRunwayLengthM, includeNotViable, onlyViable } }` | `{ aircraft, total_evaluated, viable_count, conditional_count, not_viable_count, results, filters, caveat }` |
| `POST /api/compare` | Side-by-side comparison of 2 to 3 airstrips for one aircraft | `{ aircraftId, airstripIds: [id1, id2, ...] }` (2–3 unique IDs) | `{ aircraft, comparisons, recommended_airstrip_id, summary, matrix, caveat }` |
| `GET /api/airstrips` | List airstrips as GeoJSON `FeatureCollection`; optionally evaluates against an aircraft | Query: `state`, `surface`, `min_score`, `political_severity`, `search`, `aircraft_id` | `{ type: "FeatureCollection", count, features, caveat }` (`properties.decision` added when `aircraft_id` is set) |
| `GET /api/airstrips/:id` | Retrieve a single airstrip GeoJSON `Feature` | Path: `id`; Query: optional `aircraft_id` | GeoJSON `Feature` (`properties.decision` when `aircraft_id` is set) + `caveat` |
| `GET /api/airstrips/radius` | Find airstrips within a distance radius from coordinates | Query: `lat`, `lng` (required), `radius_km` (default `150`) | `{ center, radius_km, count, airstrips, caveat }` |
| `GET /api/health` | Service and database health check (`/health` alias also mounted) | None | Health status payload |

### Sample Payloads

```json
// POST /api/evaluate
{
  "aircraftId": 3,
  "airstripId": 1
}

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
{
  "aircraftId": 1,
  "airstripIds": [1, 2, 5]
}
```
