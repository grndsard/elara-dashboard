-- Fix audit_trail table structure
USE elara_db;

-- Add missing column if not exists
ALTER TABLE audit_trail 
ADD COLUMN IF NOT EXISTS change_details TEXT AFTER new_values;

-- Verify table structure
DESCRIBE audit_trail;