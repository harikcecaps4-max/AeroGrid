#!/usr/bin/env node
'use strict';

/**
 * AeroGrid Idempotent Database Seed Script
 *
 * NOTE: All runway specifications, access-point timings, fleet allocations, and
 * political influence annotations below are ILLUSTRATIVE synthetic/public-reference
 * seed data for development, spatial testing, and decision-support demonstrations.
 *
 * Usage:
 *   node db/seed.js             # Populate Neon PostgreSQL cleanly (idempotent)
 *   node db/seed.js --dry-run   # Validate all seed rows against DB CHECK & FK constraints offline
 */

const fs = require('fs');
const path = require('path');
const { computeAirstripChecksum } = require('../server/src/utils/integrity');

function loadPg() {
  const candidates = [
    'pg',
    path.resolve(__dirname, '../server/node_modules/pg'),
    path.resolve(__dirname, '../functions/aerogrid_api/node_modules/pg'),
  ];
  for (const modPath of candidates) {
    try {
      return require(modPath);
    } catch {
      // try next path
    }
  }
  return null;
}

function loadEnvFiles() {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../server/.env'),
    path.resolve(__dirname, '../functions/aerogrid_api/.env'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SURFACE_TYPES = ['asphalt', 'concrete', 'gravel', 'grass', 'laterite', 'unpaved'];
const OWNERSHIP_TYPES = ['private', 'municipal', 'state', 'central', 'defence', 'psu'];
const ACCESS_TYPES = ['highway', 'rail', 'city_centre', 'hospital', 'bus_terminal', 'industrial_hub', 'port'];
const FLEET_CATEGORIES = ['eVTOL', 'STOL', 'turboprop', 'hybrid'];

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
  { name: 'Jakkur Aerodrome', state: 'Karnataka', ownership: 'state', surface: 'asphalt', lon: 77.6065, lat: 13.0782, elevation_m: 900, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Toranagallu (JSW) Airstrip', state: 'Karnataka', ownership: 'private', surface: 'asphalt', lon: 76.6350, lat: 15.1750, elevation_m: 530, runway_length_m: 1800, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Bidar Air Force & Civil Enclave', state: 'Karnataka', ownership: 'central', surface: 'asphalt', lon: 77.4871, lat: 17.9081, elevation_m: 650, runway_length_m: 2400, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Kolar Field Strip', state: 'Karnataka', ownership: 'municipal', surface: 'gravel', lon: 78.1290, lat: 13.1360, elevation_m: 820, runway_length_m: 700, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'moderate', disruption_type: 'Environmental & Noise Ordinance Petitions' },
  { name: 'Hassan Regional Strip', state: 'Karnataka', ownership: 'municipal', surface: 'grass', lon: 76.0960, lat: 13.0070, elevation_m: 950, runway_length_m: 650, runway_width_m: 18, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'moderate', disruption_type: 'Electoral Alignment & Funding Delays' },
  { name: 'Coorg Plantation Strip', state: 'Karnataka', ownership: 'private', surface: 'grass', lon: 75.7390, lat: 12.4210, elevation_m: 1050, runway_length_m: 600, runway_width_m: 15, night_landing: false, fuel_available: false, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Hosur Aerodrome', state: 'Tamil Nadu', ownership: 'private', surface: 'asphalt', lon: 77.8250, lat: 12.7370, elevation_m: 880, runway_length_m: 1100, runway_width_m: 25, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'low', disruption_type: 'Inter-State Concession Airspace Agreement Delays' },
  { name: 'Salem Regional Airstrip', state: 'Tamil Nadu', ownership: 'state', surface: 'asphalt', lon: 78.0660, lat: 11.7830, elevation_m: 280, runway_length_m: 1200, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'low', disruption_type: 'Bureaucratic Route Reallocation' },
  { name: 'Vellore Abdullapuram Airstrip', state: 'Tamil Nadu', ownership: 'municipal', surface: 'gravel', lon: 79.0900, lat: 12.9070, elevation_m: 215, runway_length_m: 750, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'high', disruption_type: 'Land Acquisition & Encroachment Contestation' },
  { name: 'Warangal Mamnoor Airstrip', state: 'Telangana', ownership: 'state', surface: 'asphalt', lon: 79.6060, lat: 17.9140, elevation_m: 270, runway_length_m: 1500, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Nizamabad (Jakranpalli) Strip', state: 'Telangana', ownership: 'municipal', surface: 'gravel', lon: 78.0940, lat: 18.6720, elevation_m: 395, runway_length_m: 800, runway_width_m: 20, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'high', disruption_type: 'Inter-Party Jurisdiction Dispute' },
  { name: 'Kurnool Regional Strip', state: 'Andhra Pradesh', ownership: 'state', surface: 'asphalt', lon: 78.0640, lat: 15.7120, elevation_m: 290, runway_length_m: 1000, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: true, political_severity: 'moderate', disruption_type: 'Regional Subsidy & Route Policy Volatility' },
  { name: 'Baramati Aerodrome', state: 'Maharashtra', ownership: 'state', surface: 'asphalt', lon: 74.5828, lat: 18.1517, elevation_m: 604, runway_length_m: 1770, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Shirpur Airstrip', state: 'Maharashtra', ownership: 'private', surface: 'asphalt', lon: 74.8812, lat: 21.3653, elevation_m: 220, runway_length_m: 1280, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Dhillon Aerodrome (Kalyan)', state: 'Maharashtra', ownership: 'private', surface: 'concrete', lon: 73.1812, lat: 19.2612, elevation_m: 25, runway_length_m: 1200, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Amreli Airstrip', state: 'Gujarat', ownership: 'state', surface: 'asphalt', lon: 71.2215, lat: 21.5975, elevation_m: 130, runway_length_m: 1260, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Mundra Port Industrial Strip', state: 'Gujarat', ownership: 'private', surface: 'asphalt', lon: 69.7358, lat: 22.8425, elevation_m: 15, runway_length_m: 1900, runway_width_m: 45, night_landing: true, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Bhilwara Regional Strip', state: 'Rajasthan', ownership: 'state', surface: 'asphalt', lon: 74.6514, lat: 25.3211, elevation_m: 420, runway_length_m: 1150, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Jhunjhunu Airstrip', state: 'Rajasthan', ownership: 'state', surface: 'asphalt', lon: 75.3855, lat: 28.1250, elevation_m: 315, runway_length_m: 1050, runway_width_m: 25, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Karnal Flying Club Strip', state: 'Haryana', ownership: 'state', surface: 'asphalt', lon: 77.0182, lat: 29.7214, elevation_m: 255, runway_length_m: 920, runway_width_m: 25, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Pinjore Airfield', state: 'Haryana', ownership: 'state', surface: 'asphalt', lon: 76.9056, lat: 30.7981, elevation_m: 580, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Aligarh (Dhanipur) Airstrip', state: 'Uttar Pradesh', ownership: 'state', surface: 'asphalt', lon: 78.1402, lat: 27.8821, elevation_m: 185, runway_length_m: 1250, runway_width_m: 30, night_landing: true, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Sonari Airstrip Jamshedpur', state: 'Jharkhand', ownership: 'private', surface: 'asphalt', lon: 86.1683, lat: 22.8139, elevation_m: 145, runway_length_m: 1030, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: true, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Gopalpur (Rangeilunda) Airstrip', state: 'Odisha', ownership: 'state', surface: 'asphalt', lon: 84.8458, lat: 19.2942, elevation_m: 30, runway_length_m: 1000, runway_width_m: 30, night_landing: false, fuel_available: false, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
  { name: 'Kullu Bhuntar Runway', state: 'Himachal Pradesh', ownership: 'state', surface: 'asphalt', lon: 77.1542, lat: 31.8767, elevation_m: 1089, runway_length_m: 1125, runway_width_m: 30, night_landing: false, fuel_available: true, charging_available: false, political_severity: 'none', disruption_type: 'No Disruption' },
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
  { name: 'Generic 4-seat eVTOL', category: 'eVTOL', min_runway_m: 60, range_km: 150, payload_kg: 450, passengers: 4, needs_charging: true },
  { name: 'Sarla Shunya 6-seat eVTOL', category: 'eVTOL', min_runway_m: 80, range_km: 160, payload_kg: 680, passengers: 6, needs_charging: true },
  { name: 'Electra EL-2 eSTOL', category: 'STOL', min_runway_m: 95, range_km: 800, payload_kg: 900, passengers: 9, needs_charging: true },
  { name: 'STOL commuter class', category: 'STOL', min_runway_m: 600, range_km: 800, payload_kg: 1800, passengers: 19, needs_charging: false },
  { name: 'Regional turboprop class', category: 'turboprop', min_runway_m: 1200, range_km: 1200, payload_kg: 2500, passengers: 19, needs_charging: false },
  { name: 'Cessna 208B Grand Caravan', category: 'turboprop', min_runway_m: 740, range_km: 1680, payload_kg: 1400, passengers: 9, needs_charging: false },
];

const FLEETS = [
  { name: 'BLR-Jakkur Urban Shuttle', operator_name: 'Sarla Aviation', profile: 'Sarla Shunya 6-seat eVTOL', category: 'eVTOL', aircraft_model: 'Shunya Mk1', tail_count: 4, min_runway_m: 80, requires_paved: true, range_km: 160, cruise_speed_kmh: 250, payload_kg: 680, home_airstrip: 'Jakkur Aerodrome', target_airport: 'BLR', status: 'trial_phase' },
  { name: 'MAA-Hosur Cargo Express', operator_name: 'The ePlane Company', profile: 'Generic 4-seat eVTOL', category: 'eVTOL', aircraft_model: 'e200x Cargo-Pax', tail_count: 6, min_runway_m: 60, requires_paved: true, range_km: 150, cruise_speed_kmh: 200, payload_kg: 450, home_airstrip: 'Hosur Aerodrome', target_airport: 'BLR', status: 'planned' },
  { name: 'PNQ-Baramati Training Corridor', operator_name: 'Baramati Air Mobility', profile: 'STOL commuter class', category: 'STOL', aircraft_model: 'Dornier 228-212', tail_count: 2, min_runway_m: 600, requires_paved: true, range_km: 800, cruise_speed_kmh: 370, payload_kg: 1800, home_airstrip: 'Baramati Aerodrome', target_airport: 'PNQ', status: 'active_commercial' },
  { name: 'JSW-Bellary Executive Link', operator_name: 'Vijayanagar Charter', profile: 'Regional turboprop class', category: 'turboprop', aircraft_model: 'Beechcraft King Air 350', tail_count: 2, min_runway_m: 1000, requires_paved: true, range_km: 1200, cruise_speed_kmh: 520, payload_kg: 2500, home_airstrip: 'Toranagallu (JSW) Airstrip', target_airport: 'BLR', status: 'active_commercial' },
  { name: 'Mundra Maritime Logistics Wing', operator_name: 'Kutch Aero Logistics', profile: 'Cessna 208B Grand Caravan', category: 'turboprop', aircraft_model: 'Cessna 208B EX', tail_count: 3, min_runway_m: 740, requires_paved: false, range_km: 1680, cruise_speed_kmh: 344, payload_kg: 1400, home_airstrip: 'Mundra Port Industrial Strip', target_airport: 'BOM', status: 'active_commercial' },
  { name: 'Kalyan-BOM Thane Ferry', operator_name: 'IndiAir Urban eVTOL', profile: 'Generic 4-seat eVTOL', category: 'eVTOL', aircraft_model: 'Archer Midnight (Trial)', tail_count: 3, min_runway_m: 75, requires_paved: true, range_km: 160, cruise_speed_kmh: 241, payload_kg: 450, home_airstrip: 'Dhillon Aerodrome (Kalyan)', target_airport: 'BOM', status: 'planned' },
  { name: 'Pinjore Himalayan Hopper', operator_name: 'Shivalik Regional Air', profile: 'Electra EL-2 eSTOL', category: 'hybrid', aircraft_model: 'Electra EL-2 Goldfinch', tail_count: 2, min_runway_m: 95, requires_paved: false, range_km: 800, cruise_speed_kmh: 320, payload_kg: 900, home_airstrip: 'Pinjore Airfield', target_airport: 'DEL', status: 'trial_phase' },
  { name: 'Jamshedpur Industrial Shuttle', operator_name: 'EastAir Charter', profile: 'Cessna 208B Grand Caravan', category: 'turboprop', aircraft_model: 'Viking Twin Otter 400', tail_count: 2, min_runway_m: 460, requires_paved: false, range_km: 1480, cruise_speed_kmh: 338, payload_kg: 1600, home_airstrip: 'Sonari Airstrip Jamshedpur', target_airport: 'HYD', status: 'planned' },
];

/**
 * Validates every seed row against DB-level CHECK, UNIQUE, NOT NULL, and FK constraints.
 */
function validateSeedData() {
  const errors = [];
  const stateNames = new Set(STATES.map((s) => s.name));
  const airportCodes = new Set();
  const airstripPairs = new Set();
  const airstripNames = new Set();
  const fleetNames = new Set();

  if (AIRSTRIPS.length < 15) {
    errors.push(`Expected at least 15 airstrips, got ${AIRSTRIPS.length}`);
  }
  if (AIRPORTS.length < 5) {
    errors.push(`Expected at least 5 airports, got ${AIRPORTS.length}`);
  }

  for (const ap of AIRPORTS) {
    if (!ap.code || ap.code !== ap.code.toUpperCase() || ap.code.length < 3 || ap.code.length > 4) {
      errors.push(`Invalid airport code: ${ap.code}`);
    }
    if (airportCodes.has(ap.code)) errors.push(`Duplicate airport code: ${ap.code}`);
    airportCodes.add(ap.code);
    if (!stateNames.has(ap.state)) errors.push(`Airport ${ap.code} references unknown state: ${ap.state}`);
    if (ap.lat < -90 || ap.lat > 90 || ap.lon < -180 || ap.lon > 180) {
      errors.push(`Airport ${ap.code} has out-of-range coordinates (${ap.lat}, ${ap.lon})`);
    }
  }

  for (const a of AIRSTRIPS) {
    if (!a.name) errors.push('Airstrip missing name');
    if (!stateNames.has(a.state)) errors.push(`Airstrip "${a.name}" references unknown state: ${a.state}`);
    if (!SURFACE_TYPES.includes(a.surface)) errors.push(`Airstrip "${a.name}" invalid surface: ${a.surface}`);
    if (!OWNERSHIP_TYPES.includes(a.ownership)) errors.push(`Airstrip "${a.name}" invalid ownership: ${a.ownership}`);
    if (!(a.runway_length_m > 0 && a.runway_length_m <= 6000)) errors.push(`Airstrip "${a.name}" invalid runway_length_m: ${a.runway_length_m}`);
    if (a.runway_width_m != null && !(a.runway_width_m > 0 && a.runway_width_m <= 200)) errors.push(`Airstrip "${a.name}" invalid runway_width_m: ${a.runway_width_m}`);
    if (a.elevation_m != null && (a.elevation_m < -500 || a.elevation_m > 9000)) errors.push(`Airstrip "${a.name}" invalid elevation_m: ${a.elevation_m}`);
    if (a.lat < -90 || a.lat > 90 || a.lon < -180 || a.lon > 180) {
      errors.push(`Airstrip "${a.name}" out-of-range coordinates (${a.lat}, ${a.lon})`);
    }
    const pairKey = `${a.name}::${a.state}`;
    if (airstripPairs.has(pairKey)) errors.push(`Duplicate airstrip/state pair: ${pairKey}`);
    airstripPairs.add(pairKey);
    airstripNames.add(a.name);
  }

  for (const acc of ACCESS_POINTS) {
    if (!airstripNames.has(acc.airstrip)) errors.push(`Access point "${acc.name}" references missing airstrip "${acc.airstrip}"`);
    if (!ACCESS_TYPES.includes(acc.access_type)) errors.push(`Access point "${acc.name}" invalid type: ${acc.access_type}`);
    if (acc.distance_km < 0 || acc.distance_km > 500) errors.push(`Access point "${acc.name}" invalid distance_km: ${acc.distance_km}`);
    if (acc.lat < -90 || acc.lat > 90 || acc.lon < -180 || acc.lon > 180) {
      errors.push(`Access point "${acc.name}" invalid coordinates (${acc.lat}, ${acc.lon})`);
    }
  }

  for (const f of FLEETS) {
    if (fleetNames.has(f.name)) errors.push(`Duplicate fleet name: ${f.name}`);
    fleetNames.add(f.name);
    if (!FLEET_CATEGORIES.includes(f.category)) errors.push(`Fleet "${f.name}" invalid category: ${f.category}`);
    if (!airstripNames.has(f.home_airstrip)) errors.push(`Fleet "${f.name}" references missing airstrip: ${f.home_airstrip}`);
    if (!airportCodes.has(f.target_airport)) errors.push(`Fleet "${f.name}" references missing airport: ${f.target_airport}`);
    if (!(f.tail_count > 0 && f.min_runway_m > 0 && f.range_km > 0)) errors.push(`Fleet "${f.name}" fails positive constraints`);
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      surface_types: SURFACE_TYPES.length,
      ownership_types: OWNERSHIP_TYPES.length,
      states: STATES.length,
      airports: AIRPORTS.length,
      airstrips: AIRSTRIPS.length,
      access_points: ACCESS_POINTS.length,
      aircraft_profiles: AIRCRAFT_PROFILES.length,
      fleets: FLEETS.length,
    },
  };
}

async function runSeed({ dryRun = false } = {}) {
  loadEnvFiles();
  const validation = validateSeedData();

  if (!validation.valid) {
    console.error('[ERROR] Seed validation failed:');
    for (const err of validation.errors) console.error('  -', err);
    process.exitCode = 1;
    return validation;
  }

  if (dryRun || !process.env.DATABASE_URL) {
    if (!dryRun) {
      console.warn('[WARN] DATABASE_URL is not set. Running seed integrity validation (--dry-run) instead.\n');
    }
    console.log('=== AeroGrid Seed Data Validation (DRY-RUN) ===');
    console.log('All illustrative Indian micro-airstrips, airports, access points, and fleets satisfy schema rules.');
    console.table(validation.counts);
    return validation;
  }

  const pg = loadPg();
  if (!pg) {
    throw new Error('Could not resolve `pg` package. Install dependencies first.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    // 1. Lookup tables
    for (const s of SURFACE_TYPES) {
      await client.query('INSERT INTO surface_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [s]);
    }
    for (const o of OWNERSHIP_TYPES) {
      await client.query('INSERT INTO ownership_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [o]);
    }
    for (const st of STATES) {
      await client.query(
        `INSERT INTO states (name, type, capital) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, capital = EXCLUDED.capital`,
        [st.name, st.type, st.capital]
      );
    }

    // 2. Airports
    const airportIdByCode = new Map();
    for (const ap of AIRPORTS) {
      const { rows } = await client.query(
        `INSERT INTO airports (code, name, state_id, location)
         SELECT $1, $2, s.id, ST_SetSRID(ST_MakePoint($3, $4), 4326)
         FROM states s WHERE s.name = $5
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           state_id = EXCLUDED.state_id,
           location = EXCLUDED.location
         RETURNING id`,
        [ap.code, ap.name, ap.lon, ap.lat, ap.state]
      );
      airportIdByCode.set(ap.code, rows[0].id);
    }

    // 3. Airstrips + tamper-detection checksum
    const airstripIdByName = new Map();
    const airstripLocByName = new Map();
    for (const a of AIRSTRIPS) {
      const { rows } = await client.query(
        `INSERT INTO airstrips (
           name, state_id, ownership_id, surface_id, location,
           elevation_m, runway_length_m, runway_width_m,
           night_landing, fuel_available, charging_available,
           political_severity, disruption_type, updated_at
         )
         SELECT $1, s.id, o.id, f.id, ST_SetSRID(ST_MakePoint($2, $3), 4326),
                $4, $5, $6, $7, $8, $9, $10, $11, now()
         FROM states s, ownership_types o, surface_types f
         WHERE s.name = $12 AND o.name = $13 AND f.name = $14
         ON CONFLICT (name, state_id) DO UPDATE SET
           ownership_id = EXCLUDED.ownership_id,
           surface_id = EXCLUDED.surface_id,
           location = EXCLUDED.location,
           elevation_m = EXCLUDED.elevation_m,
           runway_length_m = EXCLUDED.runway_length_m,
           runway_width_m = EXCLUDED.runway_width_m,
           night_landing = EXCLUDED.night_landing,
           fuel_available = EXCLUDED.fuel_available,
           charging_available = EXCLUDED.charging_available,
           political_severity = EXCLUDED.political_severity,
           disruption_type = EXCLUDED.disruption_type,
           updated_at = now()
         RETURNING id`,
        [
          a.name, a.lon, a.lat, a.elevation_m, a.runway_length_m, a.runway_width_m,
          a.night_landing, a.fuel_available, a.charging_available,
          a.political_severity, a.disruption_type, a.state, a.ownership, a.surface,
        ]
      );

      const stripId = rows[0].id;
      airstripIdByName.set(a.name, stripId);
      airstripLocByName.set(a.name, { lon: a.lon, lat: a.lat });

      const checksum = computeAirstripChecksum({
        id: stripId,
        name: a.name,
        runway_length_m: a.runway_length_m,
        runway_width_m: a.runway_width_m,
        surface_name: a.surface,
        longitude: a.lon,
        latitude: a.lat,
        political_severity: a.political_severity,
      });
      await client.query('UPDATE airstrips SET checksum = $1 WHERE id = $2', [checksum, stripId]);
    }

    // 4. Last-mile Airstrip Access Points
    for (const acc of ACCESS_POINTS) {
      const stripId = airstripIdByName.get(acc.airstrip);
      await client.query(
        `INSERT INTO airstrip_access_points (
           airstrip_id, access_type, name, distance_km, drive_time_mins, road_condition, location
         )
         VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
         ON CONFLICT (airstrip_id, access_type, name) DO UPDATE SET
           distance_km = EXCLUDED.distance_km,
           drive_time_mins = EXCLUDED.drive_time_mins,
           road_condition = EXCLUDED.road_condition,
           location = EXCLUDED.location`,
        [stripId, acc.access_type, acc.name, acc.distance_km, acc.drive_time_mins, acc.road_condition, acc.lon, acc.lat]
      );
    }

    // 5. PostGIS-computed Airstrip <-> Airport distances
    const { rowCount: distanceRows } = await client.query(`
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
      SELECT airstrip_id, airport_id, distance_km, bearing_deg, flight_time_evtol_mins, (rn = 1), now()
      FROM computed
      WHERE rn = 1 OR distance_km <= 600.0
      ON CONFLICT (airstrip_id, airport_id) DO UPDATE SET
        distance_km = EXCLUDED.distance_km,
        bearing_deg = EXCLUDED.bearing_deg,
        flight_time_evtol_mins = EXCLUDED.flight_time_evtol_mins,
        is_nearest = EXCLUDED.is_nearest,
        calculated_at = now()
    `);

    // 6. Aircraft Profiles & Fleets
    const profileIdByName = new Map();
    for (const p of AIRCRAFT_PROFILES) {
      const { rows } = await client.query(
        `INSERT INTO aircraft_profiles (name, category, min_runway_m, range_km, payload_kg, passengers, needs_charging)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO UPDATE SET
           category = EXCLUDED.category,
           min_runway_m = EXCLUDED.min_runway_m,
           range_km = EXCLUDED.range_km,
           payload_kg = EXCLUDED.payload_kg,
           passengers = EXCLUDED.passengers,
           needs_charging = EXCLUDED.needs_charging
         RETURNING id`,
        [p.name, p.category, p.min_runway_m, p.range_km, p.payload_kg, p.passengers, p.needs_charging]
      );
      profileIdByName.set(p.name, rows[0].id);
    }

    for (const f of FLEETS) {
      const homeId = airstripIdByName.get(f.home_airstrip);
      const targetId = airportIdByCode.get(f.target_airport);
      const profileId = profileIdByName.get(f.profile);
      const loc = airstripLocByName.get(f.home_airstrip);
      await client.query(
        `INSERT INTO fleets (
           name, operator_name, aircraft_profile_id, category, aircraft_model, tail_count,
           min_runway_m, requires_paved, range_km, cruise_speed_kmh, payload_kg,
           home_airstrip_id, target_airport_id, base_location, status, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ST_SetSRID(ST_MakePoint($14, $15), 4326), $16, now())
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
           updated_at = now()`,
        [
          f.name, f.operator_name, profileId, f.category, f.aircraft_model, f.tail_count,
          f.min_runway_m, f.requires_paved, f.range_km, f.cruise_speed_kmh, f.payload_kg,
          homeId, targetId, loc.lon, loc.lat, f.status,
        ]
      );
    }

    await client.query('COMMIT');
    console.log('=== AeroGrid Database Seed Complete ===');
    console.table({ ...validation.counts, airstrip_airport_distances: distanceRows });
    return { ...validation, distanceRows };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Database seed failed; transaction rolled back:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--validate');
  runSeed({ dryRun }).catch(() => process.exit(1));
}

module.exports = {
  SURFACE_TYPES,
  OWNERSHIP_TYPES,
  ACCESS_TYPES,
  FLEET_CATEGORIES,
  STATES,
  AIRPORTS,
  AIRSTRIPS,
  ACCESS_POINTS,
  AIRCRAFT_PROFILES,
  FLEETS,
  validateSeedData,
  runSeed,
};

