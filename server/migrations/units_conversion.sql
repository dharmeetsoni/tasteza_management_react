-- Add conversion support to units
-- base_unit_id: the "parent" unit (e.g. kg for grams, litre for ml)
-- conversion_factor: multiply this unit × factor to get base unit (e.g. 1g × 0.001 = 1kg)
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS base_unit_id    INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(20,10) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS unit_type       VARCHAR(30) DEFAULT 'weight';

-- Common conversions (run after alter)
-- Weight: base = kg (set kg first, then grams)
-- UPDATE units SET unit_type='weight', conversion_factor=1        WHERE abbreviation='kg';
-- UPDATE units SET unit_type='weight', conversion_factor=0.001, base_unit_id=(SELECT id FROM units WHERE abbreviation='kg') WHERE abbreviation='g';
-- Volume: base = litre
-- UPDATE units SET unit_type='volume', conversion_factor=1        WHERE abbreviation='l' OR abbreviation='L';
-- UPDATE units SET unit_type='volume', conversion_factor=0.001, base_unit_id=(SELECT id FROM units WHERE abbreviation='l') WHERE abbreviation='ml';
-- Count: base = pcs/portion (no conversion needed, factor=1)
