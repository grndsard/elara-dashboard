-- Elara Database Setup for phpMyAdmin
-- Copy and paste this entire script into phpMyAdmin SQL tab

-- Create database
CREATE DATABASE IF NOT EXISTS `elara_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `elara_db`;

-- Create users table
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fullname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `division` varchar(100) DEFAULT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `status` enum('active','inactive') DEFAULT 'active',
  `profile_photo` varchar(255) DEFAULT NULL,
  `force_password_change` tinyint(1) DEFAULT '0',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create datasets table
CREATE TABLE `datasets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `uploader_id` int NOT NULL,
  `upload_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `record_count` int DEFAULT '0',
  `status` enum('processing','completed','failed') DEFAULT 'processing',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uploader_id` (`uploader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create dataset_records table
CREATE TABLE `dataset_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_code` varchar(50) DEFAULT NULL,
  `company_display_name` varchar(255) DEFAULT NULL,
  `location_display_name` varchar(255) DEFAULT NULL,
  `location_area_code` varchar(50) DEFAULT NULL,
  `location_parent_code` varchar(50) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `partner_display_name` varchar(255) DEFAULT NULL,
  `unit_department_name` varchar(255) DEFAULT NULL,
  `business_display_name` varchar(255) DEFAULT NULL,
  `account_group_name` varchar(255) DEFAULT NULL,
  `account_code` varchar(50) DEFAULT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `product_display_name` varchar(255) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `debit` decimal(15,2) DEFAULT '0.00',
  `credit` decimal(15,2) DEFAULT '0.00',
  `balance` decimal(15,2) DEFAULT '0.00',
  `journal_type` varchar(100) DEFAULT NULL,
  `journal_entry_number` varchar(100) DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `id_project_display_name` varchar(255) DEFAULT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `type_display_name` varchar(255) DEFAULT NULL,
  `month` varchar(20) DEFAULT NULL,
  `company2` varchar(255) DEFAULT NULL,
  `regional` varchar(255) DEFAULT NULL,
  `ref` varchar(255) DEFAULT NULL,
  `divisi` varchar(255) DEFAULT NULL,
  `grouping_bisnis` varchar(255) DEFAULT NULL,
  `akun_utama` varchar(255) DEFAULT NULL,
  `figure_utama` varchar(255) DEFAULT NULL,
  `akun_group_1` varchar(255) DEFAULT NULL,
  `akun_group_2_type` varchar(255) DEFAULT NULL,
  `figure_actual` varchar(255) DEFAULT NULL,
  `cek_holding` varchar(255) DEFAULT NULL,
  `dataset_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_code` (`company_code`),
  KEY `idx_dataset_id` (`dataset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit_trail table
CREATE TABLE `audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `action` varchar(255) NOT NULL,
  `table_name` varchar(100) DEFAULT NULL,
  `record_id` int DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert admin user (password: Admin123!)
INSERT INTO `users` (`fullname`, `email`, `password`, `role`, `status`) VALUES
('Administrator', 'admin@elara.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/pxpgFHu', 'admin', 'active');

-- Success message
SELECT 'Database elara_db created successfully! Login: admin@elara.com / Admin123!' as message;