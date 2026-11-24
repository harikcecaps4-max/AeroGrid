-- db/data_quality.sql
-- Read-only data quality report for AeroGrid airstrips.
-- Reports counts of duplicate active airstrips, NULL decision fields, and invalid records.

SELECT metric, count
FROM (
  SELECT 1 AS ord, 'active_airstrips' AS metric,
         COUNT(*)::int AS count
  FROM airstrips
  WHERE data_status <> 'archived'

  UNION ALL
  SELECT 2, 'archived_airstrips',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status = 'archived'

  UNION ALL
  SELECT 3, 'duplicate_active_pairs_within_100m',
         COUNT(*)::int
  FROM airstrips a
  JOIN airstrips b
    ON a.id < b.id
   AND a.data_status <> 'archived'
   AND b.data_status <> 'archived'
   AND ST_DWithin(a.location::geography, b.location::geography, 100)

  UNION ALL
  SELECT 4, 'null_elevation_m',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived' AND elevation_m IS NULL

  UNION ALL
  SELECT 5, 'null_runway_length_m',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived' AND runway_length_m IS NULL

  UNION ALL
  SELECT 6, 'null_terrain_risk',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived' AND terrain_risk IS NULL

  UNION ALL
  SELECT 7, 'null_catchment_population',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived' AND catchment_population IS NULL

  UNION ALL
  SELECT 8, 'null_last_mile_access_km',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived' AND last_mile_access_km IS NULL

  UNION ALL
  SELECT 9, 'null_fuel_or_charging_or_night',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived'
    AND (fuel_available IS NULL OR charging_available IS NULL OR night_landing IS NULL)

  UNION ALL
  SELECT 10, 'invalid_runway_or_coords',
         COUNT(*)::int
  FROM airstrips
  WHERE data_status <> 'archived'
    AND (
      runway_length_m <= 0
      OR runway_length_m > 6000
      OR ST_SRID(location) <> 4326
      OR ST_Y(location) NOT BETWEEN -90 AND 90
      OR ST_X(location) NOT BETWEEN -180 AND 180
    )

  UNION ALL
  SELECT 11, 'active_missing_primary_runway',
         COUNT(*)::int
  FROM airstrips a
  LEFT JOIN v_airstrip_primary_runway pr ON pr.airstrip_id = a.id
  WHERE a.data_status <> 'archived' AND pr.runway_id IS NULL
) report
ORDER BY ord;
