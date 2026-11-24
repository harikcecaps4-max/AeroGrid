'use strict';

/**
 * Plain seed data module for AeroGrid.
 * Imported by both `db/seed.js` and `server/src/services/decisionDataService.js`
 * so runtime server services do not depend on `db/seed.js`.
 */

const SURFACE_TYPES = ['asphalt', 'concrete', 'gravel', 'grass', 'laterite', 'unpaved'];
const OWNERSHIP_TYPES = ['private', 'municipal', 'state', 'central', 'defence', 'psu'];
const ACCESS_TYPES = ['highway', 'rail', 'city_centre', 'hospital', 'bus_terminal', 'industrial_hub', 'port'];
const FLEET_CATEGORIES = ['eVTOL', 'STOL', 'turboprop', 'hybrid'];
const AIRCRAFT_CATEGORIES = ['evtol', 'stol', 'light_fixed_wing', 'turboprop'];
const TERRAIN_RISK_LEVELS = ['low', 'moderate', 'high', 'severe'];
const DATA_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unverified'];
const PLACEHOLDER_AIRCRAFT_SOURCE = 'PLACEHOLDER - verify against manufacturer data';
const PLACEHOLDER_AIRSTRIP_SOURCE = 'PLACEHOLDER - unverified regional registry';

const STATES = [
  { name: 'Andhra Pradesh', type: 'State', capital: 'Amaravati' },
  { name: 'Delhi', type: 'Union Territory', capital: 'New Delhi' },
  { name: 'Gujarat', type: 'State', capital: 'Gandhinagar' },
  { name: 'Haryana', type: 'State', capital: 'Chandigarh' },
  { name: 'Himachal Pradesh', type: 'State', capital: 'Shimla' },
  { name: 'Jharkhand', type: 'State', capital: 'Ranchi' },
  { name: 'Karnataka', type: 'State', capital: 'Bengaluru' },
  { name: 'Maharashtra', type: 'State', capital: 'Mumbai' },
  { name: 'Odisha', type: 'State', capital: 'Bhubaneswar' },
  { name: 'Rajasthan', type: 'State', capital: 'Jaipur' },
  { name: 'Tamil Nadu', type: 'State', capital: 'Chennai' },
  { name: 'Telangana', type: 'State', capital: 'Hyderabad' },
  { name: 'Uttar Pradesh', type: 'State', capital: 'Lucknow' },
];

// 10 Realistic Major Indian Hub Airports (exceeds 5 required)
const AIRPORTS = [
  { code: 'BLR', name: 'Bengaluru Kempegowda Intl', state: 'Karnataka', lon: 77.7063, lat: 13.1979 },
  { code: 'MYQ', name: 'Mysuru Airport', state: 'Karnataka', lon: 76.6558, lat: 12.2300 },
  { code: 'HBX', name: 'Hubballi Airport', state: 'Karnataka', lon: 75.0849, lat: 15.3617 },
  { code: 'IXG', name: 'Belagavi Airport', state: 'Karnataka', lon: 74.6183, lat: 15.8593 },
  { code: 'IXE', name: 'Mangaluru Intl', state: 'Karnataka', lon: 74.8901, lat: 12.9613 },
  { code: 'HYD', name: 'Hyderabad Rajiv Gandhi Intl', state: 'Telangana', lon: 78.4294, lat: 17.2403 },
  { code: 'MAA', name: 'Chennai Intl', state: 'Tamil Nadu', lon: 80.1709, lat: 12.9941 },
  { code: 'BOM', name: 'Mumbai Chhatrapati Shivaji', state: 'Maharashtra', lon: 72.8679, lat: 19.0896 },
  { code: 'PNQ', name: 'Pune Intl Airport', state: 'Maharashtra', lon: 73.9197, lat: 18.5821 },
  { code: 'DEL', name: 'Delhi Indira Gandhi Intl', state: 'Delhi', lon: 77.1000, lat: 28.5562 },
];

// 25 Realistic Indian Micro-Airstrips (exceeds 15 required; illustrative operational specs)
const AIRSTRIPS = [
  { name: 'Jakkur Aerodrome', state: 'Karnataka', ownership: 'state', surface: 'asphalt', lon: 77.6065, lat: 13.0782, elevation_m: 900, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Toranagallu (JSW) Airstrip', state: 'Karnataka', ownership: 'private', surface: 'asphalt', lon: 76.6350, lat: 15.1750, elevation_m: 530, runway_length_m: 1800, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Bidar Air Force & Civil Enclave', state: 'Karnataka', ownership: 'central', surface: 'asphalt', lon: 77.4871, lat: 17.9081, elevation_m: 650, runway_length_m: 2400, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Kolar Field Strip', state: 'Karnataka', ownership: 'municipal', surface: 'gravel', lon: 78.1290, lat: 13.1360, elevation_m: 820, runway_length_m: 700, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'moderate', disruption_type: 'Environmental & Noise Ordinance Petitions', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Hassan Regional Strip', state: 'Karnataka', ownership: 'municipal', surface: 'grass', lon: 76.0960, lat: 13.0070, elevation_m: 950, runway_length_m: 650, runway_width_m: 18, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'moderate', disruption_type: 'Electoral Alignment & Funding Delays', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Coorg Plantation Strip', state: 'Karnataka', ownership: 'private', surface: 'grass', lon: 75.7390, lat: 12.4210, elevation_m: 1050, runway_length_m: 600, runway_width_m: 15, night_landing: false, fuel_available: false, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Hosur Aerodrome', state: 'Tamil Nadu', ownership: 'private', surface: 'asphalt', lon: 77.8250, lat: 12.7370, elevation_m: 880, runway_length_m: 1100, runway_width_m: 25, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'low', disruption_type: 'Inter-State Concession Airspace Agreement Delays', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Salem Regional Airstrip', state: 'Tamil Nadu', ownership: 'state', surface: 'asphalt', lon: 78.0660, lat: 11.7830, elevation_m: 280, runway_length_m: 1200, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'low', disruption_type: 'Bureaucratic Route Reallocation', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Vellore Abdullapuram Airstrip', state: 'Tamil Nadu', ownership: 'municipal', surface: 'gravel', lon: 79.0900, lat: 12.9070, elevation_m: 215, runway_length_m: 750, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'high', disruption_type: 'Land Acquisition & Encroachment Contestation', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Warangal Mamnoor Airstrip', state: 'Telangana', ownership: 'state', surface: 'asphalt', lon: 79.6060, lat: 17.9140, elevation_m: 270, runway_length_m: 1500, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Nizamabad (Jakranpalli) Strip', state: 'Telangana', ownership: 'municipal', surface: 'gravel', lon: 78.0940, lat: 18.6720, elevation_m: 395, runway_length_m: 800, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'high', disruption_type: 'Inter-Party Jurisdiction Dispute', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Kurnool Regional Strip', state: 'Andhra Pradesh', ownership: 'state', surface: 'asphalt', lon: 78.0640, lat: 15.7120, elevation_m: 290, runway_length_m: 1000, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: true, political_severity: 'moderate', disruption_type: 'Regional Subsidy & Route Policy Volatility', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Baramati Aerodrome', state: 'Maharashtra', ownership: 'state', surface: 'asphalt', lon: 74.5828, lat: 18.1517, elevation_m: 604, runway_length_m: 1770, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Shirpur Airstrip', state: 'Maharashtra', ownership: 'private', surface: 'asphalt', lon: 74.8812, lat: 21.3653, elevation_m: 220, runway_length_m: 1280, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Dhillon Aerodrome (Kalyan)', state: 'Maharashtra', ownership: 'private', surface: 'concrete', lon: 73.1812, lat: 19.2612, elevation_m: 25, runway_length_m: 1200, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Amreli Airstrip', state: 'Gujarat', ownership: 'state', surface: 'asphalt', lon: 71.2215, lat: 21.5975, elevation_m: 130, runway_length_m: 1260, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Mundra Port Industrial Strip', state: 'Gujarat', ownership: 'private', surface: 'asphalt', lon: 69.7358, lat: 22.8425, elevation_m: 15, runway_length_m: 1900, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Bhilwara Regional Strip', state: 'Rajasthan', ownership: 'state', surface: 'asphalt', lon: 74.6514, lat: 25.3211, elevation_m: 420, runway_length_m: 1150, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Jhunjhunu Airstrip', state: 'Rajasthan', ownership: 'state', surface: 'asphalt', lon: 75.3855, lat: 28.1250, elevation_m: 315, runway_length_m: 1050, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Karnal Flying Club Strip', state: 'Haryana', ownership: 'state', surface: 'asphalt', lon: 77.0182, lat: 29.7214, elevation_m: 255, runway_length_m: 920, runway_width_m: 25, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Pinjore Airfield', state: 'Haryana', ownership: 'state', surface: 'asphalt', lon: 76.9056, lat: 30.7981, elevation_m: 580, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Aligarh (Dhanipur) Airstrip', state: 'Uttar Pradesh', ownership: 'state', surface: 'asphalt', lon: 78.1402, lat: 27.8821, elevation_m: 185, runway_length_m: 1250, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Sonari Airstrip Jamshedpur', state: 'Jharkhand', ownership: 'private', surface: 'asphalt', lon: 86.1683, lat: 22.8139, elevation_m: 145, runway_length_m: 1030, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Gopalpur (Rangeilunda) Airstrip', state: 'Odisha', ownership: 'state', surface: 'asphalt', lon: 84.8458, lat: 19.2942, elevation_m: 30, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
  { name: 'Kullu Bhuntar Runway', state: 'Himachal Pradesh', ownership: 'state', surface: 'asphalt', lon: 77.1542, lat: 31.8767, elevation_m: 1089, runway_length_m: 1125, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption', terrain_risk: null, catchment_population: null, last_mile_access_km: null, data_confidence: 'low', source: PLACEHOLDER_AIRSTRIP_SOURCE, verified_at: null },
];

// 30+ Last-Mile Multimodal Access Points linked to Airstrips
const ACCESS_POINTS = [
  { airstrip: 'Jakkur Aerodrome', access_type: 'highway', name: 'NH-44 Bellary Road Interchange', distance_km: 1.8, drive_time_mins: 5, road_condition: 'expressway', lon: 77.5945, lat: 13.0762 },
  { airstrip: 'Jakkur Aerodrome', access_type: 'rail', name: 'Yelahanka Junction Railway Station', distance_km: 4.2, drive_time_mins: 11, road_condition: 'paved', lon: 77.5961, lat: 13.1007 },
  { airstrip: 'Jakkur Aerodrome', access_type: 'city_centre', name: 'Bengaluru Hebbal CBD', distance_km: 7.5, drive_time_mins: 18, road_condition: 'expressway', lon: 77.5913, lat: 13.0354 },
  { airstrip: 'Toranagallu (JSW) Airstrip', access_type: 'highway', name: 'NH-67 Ballari-Hosapete Highway', distance_km: 2.4, drive_time_mins: 6, road_condition: 'paved', lon: 76.6520, lat: 15.1640 },
  { airstrip: 'Toranagallu (JSW) Airstrip', access_type: 'rail', name: 'Toranagallu Railway Junction', distance_km: 3.1, drive_time_mins: 8, road_condition: 'paved', lon: 76.6660, lat: 15.1710 },
  { airstrip: 'Toranagallu (JSW) Airstrip', access_type: 'industrial_hub', name: 'JSW Vijayanagar Steel Township', distance_km: 4.5, drive_time_mins: 10, road_condition: 'expressway', lon: 76.6700, lat: 15.1580 },
  { airstrip: 'Bidar Air Force & Civil Enclave', access_type: 'highway', name: 'NH-65 Bidar Bypass Corridor', distance_km: 4.0, drive_time_mins: 10, road_condition: 'paved', lon: 77.5150, lat: 17.9120 },
  { airstrip: 'Bidar Air Force & Civil Enclave', access_type: 'rail', name: 'Bidar Railway Station', distance_km: 5.4, drive_time_mins: 14, road_condition: 'paved', lon: 77.5230, lat: 17.9160 },
  { airstrip: 'Hosur Aerodrome', access_type: 'highway', name: 'NH-44 Hosur-Bengaluru Expressway', distance_km: 6.2, drive_time_mins: 13, road_condition: 'expressway', lon: 77.8290, lat: 12.7420 },
  { airstrip: 'Hosur Aerodrome', access_type: 'industrial_hub', name: 'SIPCOT Industrial Complex Phase II', distance_km: 3.4, drive_time_mins: 9, road_condition: 'paved', lon: 77.8480, lat: 12.7520 },
  { airstrip: 'Hosur Aerodrome', access_type: 'hospital', name: 'Kauvery Multi-Specialty Hospital', distance_km: 7.1, drive_time_mins: 16, road_condition: 'paved', lon: 77.8320, lat: 12.7350 },
  { airstrip: 'Salem Regional Airstrip', access_type: 'highway', name: 'NH-44 Salem-Bengaluru Highway', distance_km: 2.1, drive_time_mins: 5, road_condition: 'expressway', lon: 78.0810, lat: 11.7860 },
  { airstrip: 'Salem Regional Airstrip', access_type: 'rail', name: 'Salem Junction Railway Station', distance_km: 17.4, drive_time_mins: 28, road_condition: 'paved', lon: 78.1460, lat: 11.6680 },
  { airstrip: 'Kolar Field Strip', access_type: 'highway', name: 'NH-75 Bengaluru-Tirupati Highway', distance_km: 2.8, drive_time_mins: 7, road_condition: 'paved', lon: 78.1310, lat: 13.1440 },
  { airstrip: 'Kurnool Regional Strip', access_type: 'highway', name: 'NH-44 Hyderabad-Anantapur Corridor', distance_km: 3.5, drive_time_mins: 8, road_condition: 'expressway', lon: 78.0550, lat: 15.7240 },
  { airstrip: 'Kurnool Regional Strip', access_type: 'city_centre', name: 'Kurnool Municipal Centre', distance_km: 18.2, drive_time_mins: 29, road_condition: 'paved', lon: 78.0370, lat: 15.8280 },
  { airstrip: 'Warangal Mamnoor Airstrip', access_type: 'highway', name: 'NH-163 Warangal Outer Ring Road', distance_km: 4.1, drive_time_mins: 9, road_condition: 'paved', lon: 79.6120, lat: 17.9450 },
  { airstrip: 'Warangal Mamnoor Airstrip', access_type: 'rail', name: 'Kazipet Railway Junction', distance_km: 14.6, drive_time_mins: 24, road_condition: 'paved', lon: 79.5120, lat: 17.9780 },
  { airstrip: 'Hassan Regional Strip', access_type: 'highway', name: 'NH-75 Bengaluru-Mangaluru Highway', distance_km: 3.2, drive_time_mins: 8, road_condition: 'paved', lon: 76.1120, lat: 13.0090 },
  { airstrip: 'Coorg Plantation Strip', access_type: 'highway', name: 'SH-88 Madikeri-Mysuru Road', distance_km: 4.6, drive_time_mins: 12, road_condition: 'semi-paved', lon: 75.7450, lat: 12.4260 },
  { airstrip: 'Vellore Abdullapuram Airstrip', access_type: 'hospital', name: 'CMC Vellore Medical Campus', distance_km: 8.4, drive_time_mins: 19, road_condition: 'paved', lon: 79.1350, lat: 12.9240 },
  { airstrip: 'Nizamabad (Jakranpalli) Strip', access_type: 'highway', name: 'NH-44 Jakranpalli Interchange', distance_km: 2.9, drive_time_mins: 7, road_condition: 'paved', lon: 78.1200, lat: 18.6650 },
  { airstrip: 'Baramati Aerodrome', access_type: 'highway', name: 'SH-10 Baramati MIDC Expressway', distance_km: 1.9, drive_time_mins: 4, road_condition: 'expressway', lon: 74.5900, lat: 18.1650 },
  { airstrip: 'Baramati Aerodrome', access_type: 'industrial_hub', name: 'Baramati MIDC Aerospace Park', distance_km: 2.6, drive_time_mins: 6, road_condition: 'paved', lon: 74.5950, lat: 18.1720 },
  { airstrip: 'Shirpur Airstrip', access_type: 'highway', name: 'NH-52 Agra-Mumbai Corridor', distance_km: 3.8, drive_time_mins: 8, road_condition: 'paved', lon: 74.8880, lat: 21.3510 },
  { airstrip: 'Dhillon Aerodrome (Kalyan)', access_type: 'rail', name: 'Kalyan Central Railway Junction', distance_km: 6.8, drive_time_mins: 17, road_condition: 'paved', lon: 73.1305, lat: 19.2350 },
  { airstrip: 'Dhillon Aerodrome (Kalyan)', access_type: 'highway', name: 'Samruddhi Mahamarg Thane Link', distance_km: 5.2, drive_time_mins: 12, road_condition: 'expressway', lon: 73.1750, lat: 19.2480 },
  { airstrip: 'Amreli Airstrip', access_type: 'highway', name: 'NH-351 Saurashtra Coastal Link', distance_km: 3.0, drive_time_mins: 7, road_condition: 'paved', lon: 71.2290, lat: 21.6050 },
  { airstrip: 'Mundra Port Industrial Strip', access_type: 'port', name: 'Adani Mundra Container Terminal', distance_km: 7.4, drive_time_mins: 14, road_condition: 'expressway', lon: 69.7080, lat: 22.7750 },
  { airstrip: 'Mundra Port Industrial Strip', access_type: 'highway', name: 'NH-41 Mundra-Bhuj Freight Corridor', distance_km: 2.2, drive_time_mins: 5, road_condition: 'expressway', lon: 69.7420, lat: 22.8510 },
  { airstrip: 'Bhilwara Regional Strip', access_type: 'highway', name: 'NH-48 Ajmer-Udaipur Six-Lane', distance_km: 4.9, drive_time_mins: 10, road_condition: 'expressway', lon: 74.6360, lat: 25.3410 },
  { airstrip: 'Jhunjhunu Airstrip', access_type: 'city_centre', name: 'Jhunjhunu Collectorate Junction', distance_km: 3.6, drive_time_mins: 9, road_condition: 'paved', lon: 75.3980, lat: 28.1290 },
  { airstrip: 'Karnal Flying Club Strip', access_type: 'highway', name: 'NH-44 Grand Trunk Expressway', distance_km: 3.1, drive_time_mins: 7, road_condition: 'expressway', lon: 76.9890, lat: 29.6850 },
  { airstrip: 'Pinjore Airfield', access_type: 'highway', name: 'NH-5 Chandigarh-Shimla Himalayan Way', distance_km: 1.7, drive_time_mins: 4, road_condition: 'paved', lon: 76.9120, lat: 30.8010 },
  { airstrip: 'Aligarh (Dhanipur) Airstrip', access_type: 'highway', name: 'NH-509 Aligarh-Agra Corridor', distance_km: 2.5, drive_time_mins: 6, road_condition: 'paved', lon: 78.1280, lat: 27.8780 },
  { airstrip: 'Sonari Airstrip Jamshedpur', access_type: 'industrial_hub', name: 'Tata Steel Jamshedpur Plant Gate', distance_km: 4.8, drive_time_mins: 12, road_condition: 'paved', lon: 86.1850, lat: 22.7960 },
  { airstrip: 'Gopalpur (Rangeilunda) Airstrip', access_type: 'port', name: 'Gopalpur Deepwater Maritime Port', distance_km: 8.5, drive_time_mins: 15, road_condition: 'paved', lon: 84.9560, lat: 19.3040 },
  { airstrip: 'Kullu Bhuntar Runway', access_type: 'highway', name: 'NH-3 Kullu-Manali Valley Highway', distance_km: 1.4, drive_time_mins: 4, road_condition: 'paved', lon: 77.1520, lat: 31.8840 },
];

const AIRCRAFT_PROFILES = [
  {
    name: 'Joby S4 (Representative eVTOL)',
    category: 'evtol',
    takeoff_distance_m: 60,
    landing_distance_m: 60,
    min_runway_m: 60,
    mtow_kg: 2404,
    payload_kg: 453,
    seats: 4,
    passengers: 4,
    range_km: 160,
    needs_charging: true,
    allowed_surfaces: ['asphalt', 'concrete'],
    source: PLACEHOLDER_AIRCRAFT_SOURCE,
    notes: 'PLACEHOLDER figures for 4-passenger tilt-propeller eVTOL operating from paved FATO/runway strip. Pilot to verify against OEM POH/type data.',
  },
  {
    name: 'Electra EL-2 Goldfinch (Representative eSTOL)',
    category: 'stol',
    takeoff_distance_m: 95,
    landing_distance_m: 95,
    min_runway_m: 95,
    mtow_kg: 3175,
    payload_kg: 900,
    seats: 9,
    passengers: 9,
    range_km: 800,
    needs_charging: true,
    allowed_surfaces: ['asphalt', 'concrete', 'gravel', 'grass'],
    source: PLACEHOLDER_AIRCRAFT_SOURCE,
    notes: 'PLACEHOLDER figures for hybrid-electric blown-lift ultra-short takeoff aircraft. Pilot to verify against OEM specification sheet.',
  },
  {
    name: 'Viking DHC-6 Twin Otter Series 400',
    category: 'stol',
    takeoff_distance_m: 366,
    landing_distance_m: 320,
    min_runway_m: 366,
    mtow_kg: 5670,
    payload_kg: 1800,
    seats: 19,
    passengers: 19,
    range_km: 1480,
    needs_charging: false,
    allowed_surfaces: ['asphalt', 'concrete', 'gravel', 'grass', 'laterite'],
    source: PLACEHOLDER_AIRCRAFT_SOURCE,
    notes: 'PLACEHOLDER figures for twin-turboprop unpressurized STOL utility commuter (ISA sea level, MTOW over 50ft obstacle). Pilot to verify against Viking AFM.',
  },
  {
    name: 'Cessna 208B Grand Caravan EX',
    category: 'light_fixed_wing',
    takeoff_distance_m: 658,
    landing_distance_m: 500,
    min_runway_m: 658,
    mtow_kg: 3995,
    payload_kg: 1400,
    seats: 9,
    passengers: 9,
    range_km: 1680,
    needs_charging: false,
    allowed_surfaces: ['asphalt', 'concrete', 'gravel'],
    source: PLACEHOLDER_AIRCRAFT_SOURCE,
    notes: 'PLACEHOLDER figures for single-engine utility turboprop regional feeder (ISA sea level, MTOW over 50ft obstacle). Pilot to verify against Textron POH.',
  },
  {
    name: 'ATR 42-600S (Regional Turboprop)',
    category: 'turboprop',
    takeoff_distance_m: 1050,
    landing_distance_m: 950,
    min_runway_m: 1050,
    mtow_kg: 18600,
    payload_kg: 4900,
    seats: 48,
    passengers: 48,
    range_km: 1300,
    needs_charging: false,
    allowed_surfaces: ['asphalt', 'concrete'],
    source: PLACEHOLDER_AIRCRAFT_SOURCE,
    notes: 'PLACEHOLDER figures for regional commuter turboprop short-field variant requiring paved runway. Pilot to verify against ATR performance manual.',
  },
];

const FLEETS = [
  { name: 'BLR-Jakkur Urban Shuttle', operator_name: 'Sarla Aviation', profile: 'Joby S4 (Representative eVTOL)', category: 'eVTOL', aircraft_model: 'Shunya Mk1', tail_count: 4, min_runway_m: 80, requires_paved: true, range_km: 160, cruise_speed_kmh: 250, payload_kg: 680, home_airstrip: 'Jakkur Aerodrome', target_airport: 'BLR', status: 'trial_phase' },
  { name: 'MAA-Hosur Cargo Express', operator_name: 'The ePlane Company', profile: 'Joby S4 (Representative eVTOL)', category: 'eVTOL', aircraft_model: 'e200x Cargo-Pax', tail_count: 6, min_runway_m: 60, requires_paved: true, range_km: 150, cruise_speed_kmh: 200, payload_kg: 450, home_airstrip: 'Hosur Aerodrome', target_airport: 'BLR', status: 'planned' },
  { name: 'PNQ-Baramati Training Corridor', operator_name: 'Baramati Air Mobility', profile: 'Viking DHC-6 Twin Otter Series 400', category: 'STOL', aircraft_model: 'Dornier 228-212', tail_count: 2, min_runway_m: 600, requires_paved: true, range_km: 800, cruise_speed_kmh: 370, payload_kg: 1800, home_airstrip: 'Baramati Aerodrome', target_airport: 'PNQ', status: 'active_commercial' },
  { name: 'JSW-Bellary Executive Link', operator_name: 'Vijayanagar Charter', profile: 'ATR 42-600S (Regional Turboprop)', category: 'turboprop', aircraft_model: 'Beechcraft King Air 350', tail_count: 2, min_runway_m: 1000, requires_paved: true, range_km: 1200, cruise_speed_kmh: 520, payload_kg: 2500, home_airstrip: 'Toranagallu (JSW) Airstrip', target_airport: 'BLR', status: 'active_commercial' },
  { name: 'Mundra Maritime Logistics Wing', operator_name: 'Kutch Aero Logistics', profile: 'Cessna 208B Grand Caravan EX', category: 'turboprop', aircraft_model: 'Cessna 208B EX', tail_count: 3, min_runway_m: 740, requires_paved: false, range_km: 1680, cruise_speed_kmh: 344, payload_kg: 1400, home_airstrip: 'Mundra Port Industrial Strip', target_airport: 'BOM', status: 'active_commercial' },
  { name: 'Kalyan-BOM Thane Ferry', operator_name: 'IndiAir Urban eVTOL', profile: 'Joby S4 (Representative eVTOL)', category: 'eVTOL', aircraft_model: 'Archer Midnight (Trial)', tail_count: 3, min_runway_m: 75, requires_paved: true, range_km: 160, cruise_speed_kmh: 241, payload_kg: 450, home_airstrip: 'Dhillon Aerodrome (Kalyan)', target_airport: 'BOM', status: 'planned' },
  { name: 'Pinjore Himalayan Hopper', operator_name: 'Shivalik Regional Air', profile: 'Electra EL-2 Goldfinch (Representative eSTOL)', category: 'hybrid', aircraft_model: 'Electra EL-2 Goldfinch', tail_count: 2, min_runway_m: 95, requires_paved: false, range_km: 800, cruise_speed_kmh: 320, payload_kg: 900, home_airstrip: 'Pinjore Airfield', target_airport: 'DEL', status: 'trial_phase' },
  { name: 'Jamshedpur Industrial Shuttle', operator_name: 'EastAir Charter', profile: 'Cessna 208B Grand Caravan EX', category: 'turboprop', aircraft_model: 'Viking Twin Otter 400', tail_count: 2, min_runway_m: 460, requires_paved: false, range_km: 1480, cruise_speed_kmh: 338, payload_kg: 1600, home_airstrip: 'Sonari Airstrip Jamshedpur', target_airport: 'HYD', status: 'planned' },
];

module.exports = {
  SURFACE_TYPES,
  OWNERSHIP_TYPES,
  ACCESS_TYPES,
  FLEET_CATEGORIES,
  AIRCRAFT_CATEGORIES,
  TERRAIN_RISK_LEVELS,
  DATA_CONFIDENCE_LEVELS,
  PLACEHOLDER_AIRCRAFT_SOURCE,
  PLACEHOLDER_AIRSTRIP_SOURCE,
  STATES,
  AIRPORTS,
  AIRSTRIPS,
  ACCESS_POINTS,
  AIRCRAFT_PROFILES,
  FLEETS,
};
