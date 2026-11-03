-- 004_seed_all_airstrips.sql
-- Comprehensive national airstrips database

-- Ensure lookup tables have all surface and ownership types
INSERT INTO surface_types (name) VALUES ('asphalt'), ('concrete'), ('gravel'), ('grass') ON CONFLICT (name) DO NOTHING;
INSERT INTO ownership_types (name) VALUES ('state'), ('private'), ('central'), ('municipal') ON CONFLICT (name) DO NOTHING;

-- Insert / Update All Indian Regional Airstrips
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Jakkur Aerodrome', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(77.6065, 13.0782), 4326), 900, 1000, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Jakkur Aerodrome');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Toranagallu (JSW) Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(76.635, 15.175), 4326), 530, 1800, 45, true, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'private' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Toranagallu (JSW) Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Hosur Aerodrome', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(77.825, 12.737), 4326), 880, 1100, 25, false, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Tamil Nadu' AND o.name = 'private' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Hosur Aerodrome');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Salem Regional Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(78.066, 11.783), 4326), 280, 1200, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Tamil Nadu' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Salem Regional Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Kolar Field Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(78.129, 13.136), 4326), 820, 700, 20, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'municipal' AND f.name = 'gravel'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Kolar Field Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Kurnool Regional Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(78.064, 15.712), 4326), 290, 1000, 25, false, false, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Andhra Pradesh' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Kurnool Regional Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Warangal Mamnoor Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(79.606, 17.914), 4326), 270, 1500, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Telangana' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Warangal Mamnoor Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Bidar Air Force & Civil Enclave', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(77.4871, 17.9081), 4326), 650, 2400, 45, true, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'central' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Bidar Air Force & Civil Enclave');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Hassan Regional Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(76.096, 13.007), 4326), 950, 650, 18, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'municipal' AND f.name = 'grass'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Hassan Regional Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Coorg Plantation Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(75.739, 12.421), 4326), 1050, 600, 15, false, false, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Karnataka' AND o.name = 'private' AND f.name = 'grass'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Coorg Plantation Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Vellore Abdullapuram Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(79.09, 12.907), 4326), 215, 750, 20, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Tamil Nadu' AND o.name = 'municipal' AND f.name = 'gravel'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Vellore Abdullapuram Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Nizamabad (Jakranpalli) Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(78.094, 18.672), 4326), 395, 800, 20, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Telangana' AND o.name = 'municipal' AND f.name = 'gravel'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Nizamabad (Jakranpalli) Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Baramati Aerodrome', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(74.5828, 18.1517), 4326), 604, 1770, 30, true, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Maharashtra' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Baramati Aerodrome');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Shirpur Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(74.8812, 21.3653), 4326), 220, 1280, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Maharashtra' AND o.name = 'private' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Shirpur Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Dhillon Aerodrome (Kalyan)', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(73.1812, 19.2612), 4326), 25, 1200, 30, true, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Maharashtra' AND o.name = 'private' AND f.name = 'concrete'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Dhillon Aerodrome (Kalyan)');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Amreli Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(71.2215, 21.5975), 4326), 130, 1260, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Gujarat' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Amreli Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Mundra Port Industrial Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(69.7358, 22.8425), 4326), 15, 1900, 45, true, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Gujarat' AND o.name = 'private' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Mundra Port Industrial Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Bhilwara Regional Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(74.6514, 25.3211), 4326), 420, 1150, 25, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Rajasthan' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Bhilwara Regional Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Jhunjhunu Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(75.3855, 28.125), 4326), 315, 1050, 25, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Rajasthan' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Jhunjhunu Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Karnal Flying Club Strip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(77.0182, 29.7214), 4326), 255, 920, 25, false, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Haryana' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Karnal Flying Club Strip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Pinjore Airfield', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(76.9056, 30.7981), 4326), 580, 1000, 30, false, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Haryana' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Pinjore Airfield');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Aligarh (Dhanipur) Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(78.1402, 27.8821), 4326), 185, 1250, 30, true, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Uttar Pradesh' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Aligarh (Dhanipur) Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Sonari Airstrip Jamshedpur', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(86.1683, 22.8139), 4326), 145, 1030, 30, false, true, true
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Jharkhand' AND o.name = 'private' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Sonari Airstrip Jamshedpur');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Gopalpur (Rangeilunda) Airstrip', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(84.8458, 19.2942), 4326), 30, 1000, 30, false, false, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Odisha' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Gopalpur (Rangeilunda) Airstrip');
INSERT INTO airstrips (name, state_id, ownership_id, surface_id, location, elevation_m, runway_length_m, runway_width_m, night_landing, fuel_available, charging_available)
SELECT 'Kullu Bhuntar Runway', s.id, o.id, f.id, ST_SetSRID(ST_MakePoint(77.1542, 31.8767), 4326), 1089, 1125, 30, false, true, false
FROM states s, ownership_types o, surface_types f
WHERE s.name = 'Himachal Pradesh' AND o.name = 'state' AND f.name = 'asphalt'
AND NOT EXISTS (SELECT 1 FROM airstrips a WHERE a.name = 'Kullu Bhuntar Runway');
