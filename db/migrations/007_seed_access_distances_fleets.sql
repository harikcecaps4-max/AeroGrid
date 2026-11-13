-- 007_seed_access_distances_fleets.sql
-- Illustrative seed migration for major Indian airports, last-mile airstrip access points,
-- PostGIS-computed airstrip-to-airport distances, and regional eVTOL/STOL/turboprop fleets.
-- Fully idempotent via ON CONFLICT upserts.

-- 1. Upsert 10 Major Indian Hub Airports with 3NF state_id linkage
INSERT INTO airports (code, name, state_id, location)
SELECT v.code, v.name, s.id, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)
FROM (VALUES
  ('BLR', 'Bengaluru Kempegowda Intl',   'Karnataka',      77.7063, 13.1979),
  ('MYQ', 'Mysuru Airport',              'Karnataka',      76.6558, 12.2300),
  ('HBX', 'Hubballi Airport',            'Karnataka',      75.0849, 15.3617),
  ('IXG', 'Belagavi Airport',            'Karnataka',      74.6183, 15.8593),
  ('IXE', 'Mangaluru Intl',              'Karnataka',      74.8901, 12.9613),
  ('HYD', 'Hyderabad Rajiv Gandhi Intl', 'Telangana',      78.4294, 17.2403),
  ('MAA', 'Chennai Intl',                'Tamil Nadu',     80.1709, 12.9941),
  ('BOM', 'Mumbai Chhatrapati Shivaji',  'Maharashtra',    72.8679, 19.0896),
  ('PNQ', 'Pune Intl Airport',           'Maharashtra',    73.9197, 18.5821),
  ('DEL', 'Delhi Indira Gandhi Intl',    'Delhi',          77.1000, 28.5562)
) AS v(code, name, state_name, lon, lat)
JOIN states s ON s.name = v.state_name
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  state_id = EXCLUDED.state_id,
  location = EXCLUDED.location;

-- 2. Seed 30+ realistic last-mile airstrip_access_points (SRID 4326 Point + GiST indexed)
WITH raw_access(strip_pattern, access_type, name, distance_km, drive_time_mins, road_condition, lon, lat) AS (
  VALUES
    ('Jakkur',      'highway',        'NH-44 Bellary Road Interchange',      1.8,  5,  'expressway', 77.5945, 13.0762),
    ('Jakkur',      'rail',           'Yelahanka Junction Railway Station',  4.2,  11, 'paved',      77.5961, 13.1007),
    ('Jakkur',      'city_centre',    'Bengaluru Hebbal CBD',                7.5,  18, 'expressway', 77.5913, 13.0354),
    ('Toranagallu', 'highway',        'NH-67 Ballari-Hosapete Highway',      2.4,  6,  'paved',      76.6520, 15.1640),
    ('Toranagallu', 'rail',           'Toranagallu Railway Junction',        3.1,  8,  'paved',      76.6660, 15.1710),
    ('Toranagallu', 'industrial_hub', 'JSW Vijayanagar Steel Township',      4.5,  10, 'expressway', 76.6700, 15.1580),
    ('Bidar',       'highway',        'NH-65 Bidar Bypass Corridor',         4.0,  10, 'paved',      77.5150, 17.9120),
    ('Bidar',       'rail',           'Bidar Railway Station',               5.4,  14, 'paved',      77.5230, 17.9160),
    ('Hosur',       'highway',        'NH-44 Hosur-Bengaluru Expressway',    6.2,  13, 'expressway', 77.8290, 12.7420),
    ('Hosur',       'industrial_hub', 'SIPCOT Industrial Complex Phase II',  3.4,  9,  'paved',      77.8480, 12.7520),
    ('Hosur',       'hospital',       'Kauvery Multi-Specialty Hospital',    7.1,  16, 'paved',      77.8320, 12.7350),
    ('Salem',       'highway',        'NH-44 Salem-Bengaluru Highway',       2.1,  5,  'expressway', 78.0810, 11.7860),
    ('Salem',       'rail',           'Salem Junction Railway Station',     17.4,  28, 'paved',      78.1460, 11.6680),
    ('Kolar',       'highway',        'NH-75 Bengaluru-Tirupati Highway',    2.8,  7,  'paved',      78.1310, 13.1440),
    ('Kurnool',     'highway',        'NH-44 Hyderabad-Anantapur Corridor',  3.5,  8,  'expressway', 78.0550, 15.7240),
    ('Kurnool',     'city_centre',    'Kurnool Municipal Centre',           18.2,  29, 'paved',      78.0370, 15.8280),
    ('Warangal',    'highway',        'NH-163 Warangal Outer Ring Road',     4.1,  9,  'paved',      79.6120, 17.9450),
    ('Warangal',    'rail',           'Kazipet Railway Junction',           14.6,  24, 'paved',      79.5120, 17.9780),
    ('Hassan',      'highway',        'NH-75 Bengaluru-Mangaluru Highway',   3.2,  8,  'paved',      76.1120, 13.0090),
    ('Coorg',       'highway',        'SH-88 Madikeri-Mysuru Road',          4.6,  12, 'semi-paved', 75.7450, 12.4260),
    ('Vellore',     'hospital',       'CMC Vellore Medical Campus',          8.4,  19, 'paved',      79.1350, 12.9240),
    ('Nizamabad',   'highway',        'NH-44 Jakranpalli Interchange',       2.9,  7,  'paved',      78.1200, 18.6650),
    ('Baramati',    'highway',        'SH-10 Baramati MIDC Expressway',      1.9,  4,  'expressway', 74.5900, 18.1650),
    ('Baramati',    'industrial_hub', 'Baramati MIDC Aerospace Park',        2.6,  6,  'paved',      74.5950, 18.1720),
    ('Shirpur',     'highway',        'NH-52 Agra-Mumbai Corridor',          3.8,  8,  'paved',      74.8880, 21.3510),
    ('Kalyan',      'rail',           'Kalyan Central Railway Junction',     6.8,  17, 'paved',      73.1305, 19.2350),
    ('Kalyan',      'highway',        'Samruddhi Mahamarg Thane Link',       5.2,  12, 'expressway', 73.1750, 19.2480),
    ('Amreli',      'highway',        'NH-351 Saurashtra Coastal Link',      3.0,  7,  'paved',      71.2290, 21.6050),
    ('Mundra',      'port',           'Adani Mundra Container Terminal',     7.4,  14, 'expressway', 69.7080, 22.7750),
    ('Mundra',      'highway',        'NH-41 Mundra-Bhuj Freight Corridor',  2.2,  5,  'expressway', 69.7420, 22.8510),
    ('Bhilwara',    'highway',        'NH-48 Ajmer-Udaipur Six-Lane',        4.9,  10, 'expressway', 74.6360, 25.3410),
    ('Jhunjhunu',   'city_centre',    'Jhunjhunu Collectorate Junction',     3.6,  9,  'paved',      75.3980, 28.1290),
    ('Karnal',      'highway',        'NH-44 Grand Trunk Expressway',        3.1,  7,  'expressway', 76.9890, 29.6850),
    ('Pinjore',     'highway',        'NH-5 Chandigarh-Shimla Himalayan Way',1.7,  4,  'paved',      76.9120, 30.8010),
    ('Aligarh',     'highway',        'NH-509 Aligarh-Agra Corridor',        2.5,  6,  'paved',      78.1280, 27.8780),
    ('Sonari',      'industrial_hub', 'Tata Steel Jamshedpur Plant Gate',    4.8,  12, 'paved',      86.1850, 22.7960),
    ('Gopalpur',    'port',           'Gopalpur Deepwater Maritime Port',    8.5,  15, 'paved',      84.9560, 19.3040),
    ('Kullu',       'highway',        'NH-3 Kullu-Manali Valley Highway',    1.4,  4,  'paved',      77.1520, 31.8840)
)
INSERT INTO airstrip_access_points (airstrip_id, access_type, name, distance_km, drive_time_mins, road_condition, location)
SELECT DISTINCT ON (a.id, r.access_type, r.name)
  a.id,
  r.access_type,
  r.name,
  r.distance_km,
  r.drive_time_mins,
  r.road_condition,
  ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326)
FROM raw_access r
JOIN airstrips a ON a.name ILIKE '%' || r.strip_pattern || '%'
ORDER BY a.id, r.access_type, r.name, a.id
ON CONFLICT (airstrip_id, access_type, name) DO UPDATE SET
  distance_km = EXCLUDED.distance_km,
  drive_time_mins = EXCLUDED.drive_time_mins,
  road_condition = EXCLUDED.road_condition,
  location = EXCLUDED.location;

-- 3. Dynamically compute PostGIS great-circle distances & bearings between airstrips and airports
WITH computed AS (
  SELECT
    a.id AS airstrip_id,
    ap.id AS airport_id,
    GREATEST(ROUND((ST_Distance(a.location::geography, ap.location::geography) / 1000.0)::numeric, 2), 0.10) AS distance_km,
    CASE
      WHEN ROUND(MOD((DEGREES(ST_Azimuth(a.location::geography, ap.location::geography))::numeric + 360.0), 360.0), 2) >= 360.0 THEN 0.00
      ELSE COALESCE(ROUND(MOD((DEGREES(ST_Azimuth(a.location::geography, ap.location::geography))::numeric + 360.0), 360.0), 2), 0.00)
    END AS bearing_deg,
    GREATEST(1, CEIL((ST_Distance(a.location::geography, ap.location::geography) / 1000.0) / 240.0 * 60.0)::int) AS flight_time_evtol_mins,
    ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY a.location <-> ap.location) AS rn
  FROM airstrips a
  CROSS JOIN airports ap
)
INSERT INTO airstrip_airport_distances (
  airstrip_id, airport_id, distance_km, bearing_deg, flight_time_evtol_mins, is_nearest, calculated_at
)
SELECT
  c.airstrip_id,
  c.airport_id,
  c.distance_km,
  c.bearing_deg,
  c.flight_time_evtol_mins,
  (c.rn = 1) AS is_nearest,
  now()
FROM computed c
WHERE c.rn = 1 OR c.distance_km <= 600.0
ON CONFLICT (airstrip_id, airport_id) DO UPDATE SET
  distance_km = EXCLUDED.distance_km,
  bearing_deg = EXCLUDED.bearing_deg,
  flight_time_evtol_mins = EXCLUDED.flight_time_evtol_mins,
  is_nearest = EXCLUDED.is_nearest,
  calculated_at = now();

-- 4. Upsert Aircraft Profiles & 8 Regional Fleets (SRID 4326 geometry + GiST indexed)
INSERT INTO aircraft_profiles (name, category, min_runway_m, range_km, payload_kg, passengers, needs_charging)
VALUES
  ('Generic 4-seat eVTOL',     'eVTOL',     60,   150,  450,  4,  TRUE),
  ('Sarla Shunya 6-seat eVTOL', 'eVTOL',     80,   160,  680,  6,  TRUE),
  ('Electra EL-2 eSTOL',        'STOL',      95,   800,  900,  9,  TRUE),
  ('STOL commuter class',       'STOL',     600,   800, 1800, 19,  FALSE),
  ('Regional turboprop class',  'turboprop',1200, 1200, 2500, 19,  FALSE),
  ('Cessna 208B Grand Caravan', 'turboprop', 740, 1680, 1400,  9,  FALSE)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  min_runway_m = EXCLUDED.min_runway_m,
  range_km = EXCLUDED.range_km,
  payload_kg = EXCLUDED.payload_kg,
  passengers = EXCLUDED.passengers,
  needs_charging = EXCLUDED.needs_charging;

WITH fleet_seed(name, operator_name, profile_name, category, aircraft_model, tail_count, min_runway_m, requires_paved, range_km, cruise_speed_kmh, payload_kg, strip_pattern, target_code, status) AS (
  VALUES
    ('BLR-Jakkur Urban Shuttle',      'Sarla Aviation',        'Sarla Shunya 6-seat eVTOL', 'eVTOL',     'Shunya Mk1',             4, 80,   TRUE,  160,  250, 680,  'Jakkur',      'BLR', 'trial_phase'),
    ('MAA-Hosur Cargo Express',       'The ePlane Company',    'Generic 4-seat eVTOL',     'eVTOL',     'e200x Cargo-Pax',        6, 60,   TRUE,  150,  200, 450,  'Hosur',       'BLR', 'planned'),
    ('PNQ-Baramati Training Corridor','Baramati Air Mobility', 'STOL commuter class',       'STOL',      'Dornier 228-212',        2, 600,  TRUE,  800,  370, 1800, 'Baramati',    'PNQ', 'active_commercial'),
    ('JSW-Bellary Executive Link',    'Vijayanagar Charter',   'Regional turboprop class',  'turboprop', 'Beechcraft King Air 350',2, 1000, TRUE,  1200, 520, 2500, 'Toranagallu', 'BLR', 'active_commercial'),
    ('Mundra Maritime Logistics Wing','Kutch Aero Logistics',   'Cessna 208B Grand Caravan', 'turboprop', 'Cessna 208B EX',         3, 740,  FALSE, 1680, 344, 1400, 'Mundra',      'BOM', 'active_commercial'),
    ('Kalyan-BOM Thane Ferry',        'IndiAir Urban eVTOL',   'Generic 4-seat eVTOL',     'eVTOL',     'Archer Midnight (Trial)',3, 75,   TRUE,  160,  241, 450,  'Kalyan',      'BOM', 'planned'),
    ('Pinjore Himalayan Hopper',      'Shivalik Regional Air', 'Electra EL-2 eSTOL',        'hybrid',    'Electra EL-2 Goldfinch', 2, 95,   FALSE, 800,  320, 900,  'Pinjore',     'DEL', 'trial_phase'),
    ('Jamshedpur Industrial Shuttle', 'EastAir Charter',       'Cessna 208B Grand Caravan', 'turboprop', 'Viking Twin Otter 400',  2, 460,  FALSE, 1480, 338, 1600, 'Sonari',      'HYD', 'planned')
)
INSERT INTO fleets (
  name, operator_name, aircraft_profile_id, category, aircraft_model, tail_count,
  min_runway_m, requires_paved, range_km, cruise_speed_kmh, payload_kg,
  home_airstrip_id, target_airport_id, base_location, status
)
SELECT
  fs.name,
  fs.operator_name,
  apf.id,
  fs.category,
  fs.aircraft_model,
  fs.tail_count,
  fs.min_runway_m,
  fs.requires_paved,
  fs.range_km,
  fs.cruise_speed_kmh,
  fs.payload_kg,
  a.id,
  apt.id,
  a.location,
  fs.status
FROM fleet_seed fs
LEFT JOIN aircraft_profiles apf ON apf.name = fs.profile_name
JOIN LATERAL (
  SELECT id, location FROM airstrips WHERE name ILIKE '%' || fs.strip_pattern || '%' ORDER BY id LIMIT 1
) a ON TRUE
LEFT JOIN airports apt ON apt.code = fs.target_code
ON CONFLICT (name) DO UPDATE SET
  operator_name = EXCLUDED.operator_name,
  aircraft_profile_id = EXCLUDED.aircraft_profile_id,
  category = EXCLUDED.category,
  aircraft_model = EXCLUDED.aircraft_model,
  tail_count = EXCLUDED.tail_count,
  min_runway_m = EXCLUDED.min_runway_m,
  requires_paved = EXCLUDED.requires_paved,
  range_km = EXCLUDED.range_km,
  cruise_speed_kmh = EXCLUDED.cruise_speed_kmh,
  payload_kg = EXCLUDED.payload_kg,
  home_airstrip_id = EXCLUDED.home_airstrip_id,
  target_airport_id = EXCLUDED.target_airport_id,
  base_location = EXCLUDED.base_location,
  status = EXCLUDED.status,
  updated_at = now();

