-- 005_add_political_risk.sql
-- Add political influence and service disruption columns to airstrips table

ALTER TABLE airstrips 
ADD COLUMN IF NOT EXISTS political_severity TEXT DEFAULT 'none' CHECK (political_severity IN ('none', 'low', 'moderate', 'high')),
ADD COLUMN IF NOT EXISTS disruption_type TEXT DEFAULT 'No Disruption',
ADD COLUMN IF NOT EXISTS political_details TEXT;

-- Seed political risk parameters across illustrative regional airstrips
UPDATE airstrips SET 
  political_severity = 'high',
  disruption_type = 'Land Acquisition & Encroachment Contestation',
  political_details = 'Major local political opposition regarding runway expansion and ongoing land boundary litigation causing recurring flight permit freezes.'
WHERE name ILIKE '%Vellore%';

UPDATE airstrips SET 
  political_severity = 'high',
  disruption_type = 'Inter-Party Jurisdiction Dispute',
  political_details = 'Contested site allocation between state industrial corporation and local farmers union with frequent blockades and delayed clearances.'
WHERE name ILIKE '%Nizamabad%';

UPDATE airstrips SET 
  political_severity = 'moderate',
  disruption_type = 'Regional Subsidy & Route Policy Volatility',
  political_details = 'Changes in state administrative priorities leading to intermittent carrier subsidies and bureaucratic operational halts.'
WHERE name ILIKE '%Kurnool%';

UPDATE airstrips SET 
  political_severity = 'moderate',
  disruption_type = 'Electoral Alignment & Funding Delays',
  political_details = 'Development funding frozen during state assembly transitions; local municipal leadership friction regarding commercial traffic rights.'
WHERE name ILIKE '%Hassan%';

UPDATE airstrips SET 
  political_severity = 'moderate',
  disruption_type = 'Environmental & Noise Ordinance Petitions',
  political_details = 'Active local ward political petitions challenging night training sorties and low-altitude flight paths.'
WHERE name ILIKE '%Kolar%';

UPDATE airstrips SET 
  political_severity = 'low',
  disruption_type = 'Inter-State Concession Airspace Agreement Delays',
  political_details = 'Minor coordination friction between Karnataka and Tamil Nadu state authorities regarding Bangalore BIAL concession 150km exclusivity clauses.'
WHERE name ILIKE '%Hosur%';

UPDATE airstrips SET 
  political_severity = 'low',
  disruption_type = 'Bureaucratic Route Reallocation',
  political_details = 'Occasional rescheduling under regional UDAN slot allocation reallocations during state election periods.'
WHERE name ILIKE '%Salem%';

