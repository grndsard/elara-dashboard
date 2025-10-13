-- Database optimization for faster dashboard loading
-- Add indexes on frequently queried columns

-- Index on account_group_name for faster filtering
CREATE INDEX IF NOT EXISTS idx_dataset_records_account_group ON dataset_records(account_group_name);

-- Index on company_code for entity filtering
CREATE INDEX IF NOT EXISTS idx_dataset_records_company_code ON dataset_records(company_code);

-- Index on date for date range filtering
CREATE INDEX IF NOT EXISTS idx_dataset_records_date ON dataset_records(date);

-- Index on dataset_id for dataset filtering
CREATE INDEX IF NOT EXISTS idx_dataset_records_dataset_id ON dataset_records(dataset_id);

-- Composite index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_dataset_records_dashboard ON dataset_records(account_group_name, company_code, date, dataset_id);

-- Index on account_name for specific account filtering
CREATE INDEX IF NOT EXISTS idx_dataset_records_account_name ON dataset_records(account_name);

-- Optimize table for better performance
OPTIMIZE TABLE dataset_records;