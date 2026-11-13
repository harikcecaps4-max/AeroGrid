# AeroGrid Viva & Technical Defense Prep

This document captures architecture decisions, technical trade-offs, spatial SQL techniques, and viva defense answers compiled continuously during development.

---

## Database Layer (PostGIS 3.6 + 3NF Migrations & Spatial Indexing)

- **3NF Schema & Referential Integrity:** AeroGrid separates lookup domains (`surface_types`, `ownership_types`, `states`, `aircraft_profiles`) from spatial entities (`airstrips`, `airports`, `airstrip_access_points`, `fleets`) and the precomputed hub-connectivity table (`airstrip_airport_distances`), enforcing DB-level `CHECK` bounds (`runway_length_m > 0`, WGS-84 lat/lng ranges, valid enums), `UNIQUE` keys, and intentional `ON DELETE` rules (`RESTRICT` for core lookups, `CASCADE` for dependent access/distance records, `SET NULL` for fleet home strips).
- **Spatial Indexing & Distance Materialization:** All spatial point columns use `geometry(Point, 4326)` paired with `GiST` bounding-box indexes (`USING GIST`) to accelerate `<->` KNN nearest-neighbor lookups and `ST_DWithin` radius queries, while `db/migrate.js` tracks SHA-256 migration checksums in `schema_migrations` for transactional, idempotent execution.
