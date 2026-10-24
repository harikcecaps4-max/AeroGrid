-- Lookups
INSERT INTO surface_types (name) VALUES ('asphalt'), ('concrete'), ('gravel'), ('grass');
INSERT INTO ownership_types (name) VALUES ('private'), ('municipal'), ('state'), ('central');
INSERT INTO states (name) VALUES ('Karnataka'), ('Tamil Nadu'), ('Telangana'), ('Andhra Pradesh');

-- Airports (anchor points for connectivity queries)
INSERT INTO airports (code, name, location) VALUES
 ('BLR', 'Bengaluru Kempegowda Intl', ST_SetSRID(ST_MakePoint(77.7063, 13.1979), 4326)),
 ('MYQ', 'Mysuru Airport',            ST_SetSRID(ST_MakePoint(76.6558, 12.2300), 4326)),
 ('HBX', 'Hubballi Airport',          ST_SetSRID(ST_MakePoint(75.0849, 15.3617), 4326)),
 ('IXG', 'Belagavi Airport',          ST_SetSRID(ST_MakePoint(74.6183, 15.8593), 4326)),
 ('IXE', 'Mangaluru Intl',            ST_SetSRID(ST_MakePoint(74.8901, 12.9613), 4326)),
 ('HYD', 'Hyderabad Rajiv Gandhi Intl', ST_SetSRID(ST_MakePoint(78.4294, 17.2403), 4326)),
 ('MAA', 'Chennai Intl',              ST_SetSRID(ST_MakePoint(80.1709, 12.9941), 4326));

-- Airstrips (ILLUSTRATIVE specs for testing)
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT v.name, s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326),
       v.elev, v.len, v.wid, v.night, v.fuel, v.chg
FROM (VALUES
 ('Jakkur Aerodrome',        'Karnataka', 'state',     'asphalt', 77.6065, 13.0782,  900, 1000, 30, false, true,  false),
 ('Toranagallu (JSW)',       'Karnataka', 'private',   'asphalt', 76.6350, 15.1750,  530, 1800, 45, true,  true,  true),
 ('Bidar Airstrip',          'Karnataka', 'central',   'asphalt', 77.4871, 17.9081,  650, 2400, 45, true,  true,  false),
 ('Kolar Strip (test)',      'Karnataka', 'municipal', 'gravel',  78.1290, 13.1360,  820,  700, 20, false, false, false),
 ('Hassan Strip (test)',     'Karnataka', 'municipal', 'grass',   76.0960, 13.0070,  950,  650, 18, false, false, false),
 ('Coorg Strip (test)',      'Karnataka', 'private',   'grass',   75.7390, 12.4210, 1050,  600, 15, false, false, true),
 ('Hosur Strip (test)',      'Tamil Nadu','private',   'asphalt', 77.8250, 12.7370,  880, 1100, 25, false, true,  true),
 ('Salem Strip (test)',      'Tamil Nadu','state',     'asphalt', 78.0660, 11.7830,  280, 1200, 30, false, true,  false),
 ('Vellore Strip (test)',    'Tamil Nadu','municipal', 'gravel',  79.0900, 12.9070,  215,  750, 20, false, false, false),
 ('Warangal Strip (test)',   'Telangana', 'state',     'asphalt', 79.6060, 17.9140,  270, 1500, 30, false, true,  false),
 ('Nizamabad Strip (test)',  'Telangana', 'municipal', 'gravel',  78.0940, 18.6720,  395,  800, 20, false, false, false),
 ('Kurnool Strip (test)',    'Andhra Pradesh','state', 'asphalt', 78.0640, 15.7120,  290, 1000, 25, false, false, true)
) AS v(name, st, own, surf, lon, lat, elev, len, wid, night, fuel, chg)
JOIN states s          ON s.name = v.st
JOIN ownership_types o ON o.name = v.own
JOIN surface_types f   ON f.name = v.surf;

-- Aircraft profiles (generic classes, illustrative numbers)
INSERT INTO aircraft_profiles (name, category, min_runway_m, range_km, payload_kg, passengers, needs_charging) VALUES
 ('Generic 4-seat eVTOL',          'eVTOL',     60,  150,  450,  4, true),
 ('STOL commuter class',           'STOL',     600,  800, 1800, 19, false),
 ('Regional turboprop class',      'turboprop',1200, 1200, 2500, 19, false);