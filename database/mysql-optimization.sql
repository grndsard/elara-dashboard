-- MySQL optimization settings for faster uploads
-- Add these to your MySQL configuration (my.cnf or my.ini)

-- Memory settings
SET GLOBAL innodb_buffer_pool_size = 1G;
SET GLOBAL innodb_log_file_size = 256M;
SET GLOBAL innodb_log_buffer_size = 64M;

-- Performance settings
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL sync_binlog = 0;
SET GLOBAL innodb_doublewrite = 0;

-- Bulk insert optimizations
SET GLOBAL bulk_insert_buffer_size = 64M;
SET GLOBAL myisam_sort_buffer_size = 128M;

-- Connection settings
SET GLOBAL max_connections = 200;
SET GLOBAL thread_cache_size = 16;

-- Enable local infile for LOAD DATA LOCAL INFILE
SET GLOBAL local_infile = 1;

-- Query cache (if using older MySQL versions)
-- SET GLOBAL query_cache_size = 128M;
-- SET GLOBAL query_cache_type = 1;