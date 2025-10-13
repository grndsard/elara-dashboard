-- Optimize database indexes for faster uploads and queries
-- Run this after uploading data for better performance

-- Drop existing indexes during upload (optional)
-- ALTER TABLE dataset_records DROP INDEX idx_company_code;
-- ALTER TABLE dataset_records DROP INDEX idx_date;
-- ALTER TABLE dataset_records DROP INDEX idx_debit;
-- ALTER TABLE dataset_records DROP INDEX idx_credit;
-- ALTER TABLE dataset_records DROP INDEX idx_dataset_id;

-- Composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dataset_company ON dataset_records(dataset_id, company_code);
CREATE INDEX IF NOT EXISTS idx_dataset_account_group ON dataset_records(dataset_id, account_group_name);
CREATE INDEX IF NOT EXISTS idx_dataset_month ON dataset_records(dataset_id, month);
CREATE INDEX IF NOT EXISTS idx_balance_nonzero ON dataset_records(balance) WHERE balance != 0;

-- Optimize table for better performance
OPTIMIZE TABLE dataset_records;
OPTIMIZE TABLE datasets;

-- Update table statistics
ANALYZE TABLE dataset_records;
ANALYZE TABLE datasets;