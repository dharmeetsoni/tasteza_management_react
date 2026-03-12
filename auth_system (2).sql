-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Mar 12, 2026 at 06:05 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `auth_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `image_url`, `is_active`, `created_at`, `updated_at`) VALUES
(13, 'Grocery', 'Dry grocery items like atta, rice, dal', 'icon:🌾|color:#f4a535', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47'),
(14, 'Dairy', 'Milk, paneer, butter, curd, cream', 'icon:🥛|color:#4cc9f0', 1, '2026-03-08 12:41:47', '2026-03-08 14:12:14'),
(15, 'Vegetable', 'Fresh vegetables and greens', 'icon:🥬|color:#1db97e', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47'),
(17, 'Recipe Master', 'Base gravies, stocks and master prep items', 'icon:🌿|color:#06d6a0', 1, '2026-03-08 12:41:47', '2026-03-08 12:51:42'),
(18, 'Disposable', 'Plates, cups, boxes, packaging items', 'icon:📦|color:#7b5ea7', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47'),
(19, 'Beverage', 'Cold drinks, juices, water bottles', 'icon:🥤|color:#3a86ff', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47'),
(22, 'Fuel', 'Fuel and coal supplies', 'icon:🔥|color:#e8572a', 1, '2026-03-08 14:11:59', '2026-03-08 14:11:59'),
(23, 'Salary', 'All Chef Salary', 'icon:🥬|color:#e8572a', 1, '2026-03-08 18:57:08', '2026-03-08 18:57:08');

-- --------------------------------------------------------

--
-- Table structure for table `coupons`
--

CREATE TABLE `coupons` (
  `id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `discount_type` enum('percentage','amount') DEFAULT 'percentage',
  `discount_value` decimal(10,2) NOT NULL,
  `min_order_amount` decimal(10,2) DEFAULT 0.00,
  `max_discount` decimal(10,2) DEFAULT NULL,
  `usage_limit` int(11) DEFAULT NULL,
  `used_count` int(11) DEFAULT 0,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `date` date NOT NULL,
  `note` text DEFAULT NULL,
  `ref_type` varchar(30) DEFAULT NULL,
  `ref_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_categories`
--

CREATE TABLE `expense_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(10) DEFAULT '?',
  `color` varchar(10) DEFAULT '#888',
  `is_active` tinyint(4) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `expense_categories`
--

INSERT INTO `expense_categories` (`id`, `name`, `icon`, `color`, `is_active`, `created_at`) VALUES
(1, 'Salary', '💰', '#1db97e', 1, '2026-03-09 18:17:32'),
(2, 'Advance', '🤝', '#118ab2', 1, '2026-03-09 18:17:32'),
(3, 'Purchase', '🛒', '#e8572a', 1, '2026-03-09 18:17:32'),
(4, 'Electricity', '💡', '#f59e0b', 1, '2026-03-09 18:17:32'),
(5, 'Gas', '🔥', '#e84a5f', 1, '2026-03-09 18:17:32'),
(6, 'Rent', '🏠', '#8b5cf6', 1, '2026-03-09 18:17:32'),
(7, 'Marketing', '📣', '#06b6d4', 1, '2026-03-09 18:17:32'),
(8, 'Maintenance', '🔧', '#b07a00', 1, '2026-03-09 18:17:32'),
(9, 'Miscellaneous', '📦', '#5a5a78', 1, '2026-03-09 18:17:32');

-- --------------------------------------------------------

--
-- Table structure for table `fixed_costs`
--

CREATE TABLE `fixed_costs` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `category` enum('rent','electricity','maintenance','staff','marketing','other') DEFAULT 'other',
  `month` varchar(7) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fuel_profiles`
--

CREATE TABLE `fuel_profiles` (
  `id` int(11) NOT NULL,
  `fuel_name` varchar(100) NOT NULL,
  `fuel_type` enum('gas','coal','wood','electric','other') NOT NULL DEFAULT 'gas',
  `fuel_unit` enum('cylinder','kg','hour','day','unit') NOT NULL DEFAULT 'cylinder',
  `cost_per_unit` decimal(12,2) NOT NULL,
  `burn_duration_hours` decimal(8,2) NOT NULL DEFAULT 8.00 COMMENT 'How many hours does 1 unit of fuel last',
  `per_minute` decimal(12,6) NOT NULL DEFAULT 0.000000 COMMENT 'Auto-calculated ₹ per minute — used in recipe costing',
  `icon` varchar(10) DEFAULT '?',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fuel_profiles`
--

INSERT INTO `fuel_profiles` (`id`, `fuel_name`, `fuel_type`, `fuel_unit`, `cost_per_unit`, `burn_duration_hours`, `per_minute`, `icon`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'LPG Gas Cylinder', 'gas', 'kg', 102.00, 0.55, 3.090909, '🔵', '14.2kg cylinder, ~8 hrs cooking', '2026-03-08 19:11:15', '2026-03-08 19:16:12'),
(2, 'Coal (per kg)', 'coal', 'kg', 36.00, 0.50, 1.200000, '⚫', '1kg coal burns ~2 hrs', '2026-03-08 19:11:15', '2026-03-08 19:14:28');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `category_id` int(11) NOT NULL,
  `unit_id` int(11) NOT NULL,
  `current_quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `min_quantity` decimal(12,3) DEFAULT NULL COMMENT 'Low stock alert threshold',
  `purchase_price` decimal(10,2) DEFAULT NULL COMMENT 'Price per unit (latest)',
  `selling_price` decimal(10,2) DEFAULT NULL,
  `supplier` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inventory_items`
--

INSERT INTO `inventory_items` (`id`, `name`, `category_id`, `unit_id`, `current_quantity`, `min_quantity`, `purchase_price`, `selling_price`, `supplier`, `notes`, `created_at`, `updated_at`) VALUES
(3, 'Paneer', 14, 1, 0.000, NULL, 215.00, NULL, NULL, NULL, '2026-03-08 14:15:02', '2026-03-08 14:25:05'),
(4, 'Butter Nutralite', 14, 1, 0.000, NULL, 186.00, NULL, NULL, NULL, '2026-03-08 14:16:01', '2026-03-08 14:23:17'),
(5, 'Milk', 14, 5, 0.000, NULL, 72.00, NULL, NULL, NULL, '2026-03-08 14:16:48', '2026-03-08 14:16:48'),
(6, 'Mawa', 14, 1, 0.000, NULL, 260.00, NULL, NULL, NULL, '2026-03-08 14:17:14', '2026-03-08 14:24:44'),
(7, 'Mushroom', 14, 1, 0.000, NULL, 200.00, NULL, NULL, NULL, '2026-03-08 14:18:03', '2026-03-08 14:24:55'),
(8, 'Sweet Corn', 14, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 14:18:28', '2026-03-08 14:25:13'),
(9, 'Green Peas', 14, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 14:18:57', '2026-03-08 14:24:26'),
(10, 'Curd', 14, 1, 0.000, NULL, 67.00, NULL, NULL, NULL, '2026-03-08 14:19:27', '2026-03-08 14:23:53'),
(11, 'Amul Cheese', 14, 1, 0.000, NULL, 540.00, NULL, NULL, NULL, '2026-03-08 14:19:56', '2026-03-08 14:22:54'),
(12, 'French Fries', 14, 1, 0.000, NULL, 132.00, NULL, NULL, NULL, '2026-03-08 14:20:22', '2026-03-08 14:24:10'),
(13, 'Amul Cream', 14, 5, 0.000, NULL, 225.00, NULL, NULL, NULL, '2026-03-08 14:20:50', '2026-03-08 14:23:05'),
(14, 'Cabbage (Patta Gobi)', 15, 1, 0.000, NULL, 20.00, NULL, NULL, NULL, '2026-03-08 14:27:24', '2026-03-08 14:27:24'),
(15, 'Cauliflower (Ful Gobi)', 15, 1, 0.000, NULL, 50.00, NULL, NULL, NULL, '2026-03-08 14:28:05', '2026-03-08 14:28:05'),
(16, 'Carrot', 15, 1, 0.000, NULL, 30.00, NULL, NULL, NULL, '2026-03-08 14:28:23', '2026-03-08 14:28:23'),
(17, 'Garlic (Lasun)', 15, 1, 0.000, NULL, 140.00, NULL, NULL, NULL, '2026-03-08 14:28:57', '2026-03-08 14:28:57'),
(18, 'Ginger', 15, 1, 0.000, NULL, 70.00, NULL, NULL, NULL, '2026-03-08 14:29:29', '2026-03-08 14:30:20'),
(19, 'Cucumber (Kheera)', 15, 1, 0.000, NULL, 35.00, NULL, NULL, NULL, '2026-03-08 14:30:43', '2026-03-08 14:30:43'),
(20, 'Simla Mirch', 15, 1, 0.000, NULL, 50.00, NULL, NULL, NULL, '2026-03-08 14:31:07', '2026-03-08 14:31:07'),
(21, 'Bhindi', 15, 1, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 14:31:27', '2026-03-08 14:31:27'),
(22, 'Coriander (Dhaniya)', 15, 14, 0.000, NULL, 15.00, NULL, NULL, NULL, '2026-03-08 14:32:18', '2026-03-08 14:32:18'),
(23, 'Onion Leaves (Kanda Patta)', 15, 14, 0.000, NULL, 20.00, NULL, NULL, NULL, '2026-03-08 14:35:19', '2026-03-08 14:35:19'),
(24, 'Onion (Gravy)', 15, 1, 0.000, NULL, 18.00, NULL, NULL, NULL, '2026-03-08 14:35:47', '2026-03-08 14:35:47'),
(25, 'Onion Regular', 15, 1, 0.000, NULL, 15.00, NULL, NULL, NULL, '2026-03-08 14:35:59', '2026-03-08 14:35:59'),
(26, 'Green Chilli (Mirchi)', 15, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 14:36:31', '2026-03-08 14:36:31'),
(27, 'Beans', 15, 1, 0.000, NULL, 50.00, NULL, NULL, NULL, '2026-03-08 14:40:41', '2026-03-08 14:40:41'),
(28, 'Lime (Nimbu)', 15, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 14:41:06', '2026-03-08 14:41:06'),
(29, 'Potato (Aloo)', 15, 1, 0.000, NULL, 20.00, NULL, NULL, NULL, '2026-03-08 14:41:29', '2026-03-08 14:42:04'),
(30, 'Tomato', 15, 1, 0.000, NULL, 20.00, NULL, NULL, NULL, '2026-03-08 14:41:53', '2026-03-08 14:41:53'),
(31, 'Baigan Regular', 15, 1, 0.000, NULL, 40.00, NULL, NULL, NULL, '2026-03-08 14:42:39', '2026-03-08 14:42:39'),
(32, 'Palak', 15, 14, 0.000, NULL, 15.00, NULL, NULL, NULL, '2026-03-08 14:42:59', '2026-03-08 14:42:59'),
(33, 'Mint (Phudina)', 15, 14, 0.000, NULL, 10.00, NULL, NULL, NULL, '2026-03-08 14:43:40', '2026-03-08 14:43:40'),
(34, 'Sprouts (Matki)', 15, 1, 0.000, NULL, 110.00, NULL, NULL, NULL, '2026-03-08 14:44:09', '2026-03-08 14:44:09'),
(35, 'Chowli Beans', 15, 1, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 14:45:14', '2026-03-08 14:45:14'),
(36, 'Methi', 15, 14, 0.000, NULL, 25.00, NULL, NULL, NULL, '2026-03-08 14:45:32', '2026-03-08 14:45:32'),
(37, 'Baigan Bharta', 15, 1, 0.000, NULL, 45.00, NULL, NULL, NULL, '2026-03-08 14:45:49', '2026-03-08 14:45:49'),
(38, 'Lauki', 15, 1, 0.000, NULL, 35.00, NULL, NULL, NULL, '2026-03-08 14:46:03', '2026-03-08 14:46:03'),
(39, 'Toorai (Dodka)', 15, 1, 0.000, NULL, 70.00, NULL, NULL, NULL, '2026-03-08 14:46:26', '2026-03-08 14:46:26'),
(40, 'Coal', 22, 1, 0.000, NULL, 36.00, NULL, NULL, NULL, '2026-03-08 14:46:54', '2026-03-08 14:46:54'),
(41, 'Gas', 22, 1, 0.000, NULL, 100.00, NULL, NULL, NULL, '2026-03-08 14:47:44', '2026-03-08 14:47:44'),
(42, 'Wheat Flour', 13, 1, 0.000, NULL, 34.00, NULL, NULL, NULL, '2026-03-08 14:48:35', '2026-03-08 14:48:35'),
(43, 'Rice Kaju', 13, 1, 0.000, NULL, 42.00, NULL, NULL, NULL, '2026-03-08 14:50:27', '2026-03-08 14:50:27'),
(44, 'Maida', 13, 1, 0.000, NULL, 35.00, NULL, NULL, NULL, '2026-03-08 14:50:48', '2026-03-08 14:50:48'),
(45, 'Noodle', 13, 1, 0.000, NULL, 58.00, NULL, NULL, NULL, '2026-03-08 14:51:08', '2026-03-08 14:51:08'),
(46, 'Corn Flour', 13, 1, 0.000, NULL, 40.00, NULL, NULL, NULL, '2026-03-08 14:52:04', '2026-03-08 14:52:04'),
(47, 'Moong Dal', 13, 1, 0.000, NULL, 115.00, NULL, NULL, NULL, '2026-03-08 14:53:10', '2026-03-08 14:53:10'),
(48, 'Ambari Haldi', 13, 1, 0.000, NULL, 410.00, NULL, NULL, NULL, '2026-03-08 14:53:39', '2026-03-08 14:53:39'),
(49, 'Kaju Whole', 13, 1, 0.000, NULL, 900.00, NULL, NULL, NULL, '2026-03-08 14:54:01', '2026-03-08 14:54:01'),
(50, 'Toor Dal', 13, 1, 0.000, NULL, 138.00, NULL, NULL, NULL, '2026-03-08 14:54:18', '2026-03-08 14:54:18'),
(51, 'Shela Rice', 13, 1, 0.000, NULL, 66.00, NULL, NULL, NULL, '2026-03-08 14:54:40', '2026-03-08 14:54:40'),
(52, 'Whole Mirchi (Begdi Mirchi)', 13, 1, 0.000, NULL, 400.00, NULL, NULL, NULL, '2026-03-08 14:54:56', '2026-03-08 14:54:56'),
(53, 'Govind Ghee', 13, 1, 0.000, NULL, 700.00, NULL, NULL, NULL, '2026-03-08 14:55:26', '2026-03-08 14:55:26'),
(54, 'Jeera Loose', 13, 1, 0.000, NULL, 300.00, NULL, NULL, NULL, '2026-03-08 14:55:43', '2026-03-08 14:55:43'),
(55, 'Kaju Tukda', 13, 1, 0.000, NULL, 880.00, NULL, NULL, NULL, '2026-03-08 14:55:59', '2026-03-08 14:55:59'),
(56, 'Masoor Dal', 13, 1, 0.000, NULL, 85.00, NULL, NULL, NULL, '2026-03-08 14:56:21', '2026-03-08 14:56:21'),
(57, 'Ambari Mirchi Powder', 13, 1, 0.000, NULL, 380.00, NULL, NULL, NULL, '2026-03-08 14:57:12', '2026-03-09 05:01:19'),
(58, 'Ambari Dhaniya Powder', 13, 1, 0.000, NULL, 345.00, NULL, NULL, NULL, '2026-03-08 14:57:34', '2026-03-08 14:57:34'),
(59, 'Sunflower Oil', 13, 1, 0.000, NULL, 155.00, NULL, NULL, NULL, '2026-03-08 14:58:14', '2026-03-08 14:58:14'),
(60, 'Salt', 13, 1, 0.000, NULL, 29.00, NULL, NULL, NULL, '2026-03-08 14:58:29', '2026-03-08 14:58:29'),
(61, 'Color', 13, 1, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 14:58:41', '2026-03-08 14:58:41'),
(62, 'Kashmiri Sauf (Mouth Freshner)', 13, 1, 0.000, NULL, 85.00, NULL, NULL, NULL, '2026-03-08 14:59:10', '2026-03-08 14:59:10'),
(63, 'Elaichi', 13, 2, 0.000, NULL, 3.30, NULL, NULL, NULL, '2026-03-08 15:00:17', '2026-03-08 15:00:17'),
(64, 'Matel Scrub', 13, 11, 0.000, NULL, 80.00, NULL, NULL, NULL, '2026-03-08 15:00:42', '2026-03-08 15:00:42'),
(65, 'Pickel (Achar)', 13, 1, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 15:31:41', '2026-03-08 15:31:41'),
(66, 'Duster Ladi (Tandoor)', 13, 7, 0.000, NULL, 15.00, NULL, NULL, NULL, '2026-03-08 15:32:19', '2026-03-08 15:32:19'),
(67, 'Sev (Sev Bhaji)', 13, 1, 0.000, NULL, 120.00, NULL, NULL, NULL, '2026-03-08 15:32:43', '2026-03-08 15:32:43'),
(68, 'Nirma Powder', 13, 1, 0.000, NULL, 62.00, NULL, NULL, NULL, '2026-03-08 15:33:18', '2026-03-08 15:33:18'),
(69, 'Sugar', 13, 1, 0.000, NULL, 42.00, NULL, NULL, NULL, '2026-03-08 15:33:37', '2026-03-08 15:33:37'),
(70, 'Green Scrub', 13, 11, 0.000, NULL, 96.00, NULL, NULL, NULL, '2026-03-08 15:34:00', '2026-03-08 15:34:00'),
(71, 'Lijjat Papad', 13, 1, 0.000, NULL, 340.00, NULL, NULL, NULL, '2026-03-08 15:34:36', '2026-03-08 15:34:36'),
(72, 'Rai', 13, 1, 0.000, NULL, 120.00, NULL, NULL, NULL, '2026-03-08 15:36:05', '2026-03-08 15:36:05'),
(73, 'Duster (Big)', 13, 7, 0.000, NULL, 15.00, NULL, NULL, NULL, '2026-03-08 15:36:27', '2026-03-08 15:36:27'),
(74, 'Mustard Oil (Rai Oil)', 13, 1, 0.000, NULL, 175.00, NULL, NULL, NULL, '2026-03-08 15:36:59', '2026-03-08 15:36:59'),
(75, 'Elahchi Masala', 13, 2, 0.000, NULL, 2.20, NULL, NULL, NULL, '2026-03-08 15:39:44', '2026-03-08 15:39:44'),
(76, 'White Paper', 13, 1, 0.000, NULL, 160.00, NULL, NULL, NULL, '2026-03-08 15:40:10', '2026-03-08 15:40:10'),
(77, 'Sev (Masala Papad)', 13, 1, 0.000, NULL, 110.00, NULL, NULL, NULL, '2026-03-08 15:40:32', '2026-03-08 15:40:32'),
(78, 'Coconut Powder', 13, 1, 0.000, NULL, 260.00, NULL, NULL, NULL, '2026-03-08 15:41:09', '2026-03-08 15:41:09'),
(79, 'Magaj Beej', 13, 1, 0.000, NULL, 640.00, NULL, NULL, NULL, '2026-03-08 15:41:40', '2026-03-08 15:41:40'),
(80, 'Red Chilli Souce', 13, 5, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 15:42:24', '2026-03-08 15:42:24'),
(81, 'Soya Souce', 13, 5, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 15:42:50', '2026-03-08 15:42:50'),
(82, 'Ajino Moto', 13, 1, 0.000, NULL, 140.00, NULL, NULL, NULL, '2026-03-08 15:43:09', '2026-03-08 15:43:09'),
(83, 'Kitchen King Masala', 13, 1, 0.000, NULL, 750.00, NULL, NULL, NULL, '2026-03-08 15:43:26', '2026-03-08 15:43:26'),
(84, 'Jeera Whole', 13, 1, 0.000, NULL, 280.00, NULL, NULL, NULL, '2026-03-08 15:44:31', '2026-03-08 18:20:31'),
(85, 'Udid Dal', 13, 1, 0.000, NULL, 120.00, NULL, NULL, NULL, '2026-03-08 15:45:21', '2026-03-08 15:45:21'),
(86, 'Starful', 13, 1, 0.000, NULL, 1000.00, NULL, NULL, NULL, '2026-03-08 15:45:49', '2026-03-08 15:45:49'),
(87, 'Dal Chini', 13, 1, 0.000, NULL, 400.00, NULL, NULL, NULL, '2026-03-08 15:46:20', '2026-03-08 15:46:20'),
(88, 'Soya Chunk', 13, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 15:46:40', '2026-03-08 15:46:40'),
(89, 'Chickpeas (Kabuli Chana)', 13, 1, 0.000, NULL, 110.00, NULL, NULL, NULL, '2026-03-08 15:47:49', '2026-03-08 15:47:49'),
(90, 'Kala Mari', 13, 1, 0.000, NULL, 1000.00, NULL, NULL, NULL, '2026-03-08 15:48:04', '2026-03-08 15:48:04'),
(91, 'Black Chana', 13, 1, 0.000, NULL, 75.00, NULL, NULL, NULL, '2026-03-08 15:48:23', '2026-03-08 15:48:23'),
(92, 'Tej Patta', 13, 1, 0.000, NULL, 200.00, NULL, NULL, NULL, '2026-03-08 15:48:38', '2026-03-08 15:48:38'),
(93, 'Kalunji', 13, 1, 0.000, NULL, 360.00, NULL, NULL, NULL, '2026-03-08 15:49:01', '2026-03-08 15:49:01'),
(94, 'Vinegar', 13, 5, 0.000, NULL, 60.00, NULL, NULL, NULL, '2026-03-08 15:49:21', '2026-03-08 15:49:21'),
(95, 'Rajma', 13, 1, 0.000, NULL, 120.00, NULL, NULL, NULL, '2026-03-08 15:49:39', '2026-03-08 15:49:39'),
(96, 'Tomato Catchup', 13, 1, 0.000, NULL, 46.00, NULL, NULL, NULL, '2026-03-08 15:50:15', '2026-03-08 15:50:15'),
(97, 'Chilli Flakes', 13, 1, 0.000, NULL, 400.00, NULL, NULL, NULL, '2026-03-08 15:50:37', '2026-03-08 15:50:37'),
(98, 'Vim Bar Saboon', 13, 11, 0.000, NULL, 34.00, NULL, NULL, NULL, '2026-03-08 15:51:31', '2026-03-08 15:51:31'),
(99, 'Surf Powder', 13, 1, 0.000, NULL, 62.00, NULL, NULL, NULL, '2026-03-08 15:51:48', '2026-03-08 15:51:48'),
(100, 'Biriyani Rice', 13, 1, 0.000, NULL, 95.00, NULL, NULL, NULL, '2026-03-08 15:52:04', '2026-03-08 15:52:04'),
(101, 'Chana Dal', 13, 1, 0.000, NULL, 90.00, NULL, NULL, NULL, '2026-03-08 15:52:19', '2026-03-08 15:52:19'),
(102, 'Black Paper Powder', 13, 1, 0.000, NULL, 80.00, NULL, NULL, NULL, '2026-03-08 15:52:36', '2026-03-08 15:52:36'),
(103, 'Jawantri', 13, 1, 0.000, NULL, 1600.00, NULL, NULL, NULL, '2026-03-08 15:53:05', '2026-03-08 15:53:05'),
(104, 'Penutes', 13, 1, 0.000, NULL, 120.00, NULL, NULL, NULL, '2026-03-08 15:54:56', '2026-03-08 15:54:56'),
(105, 'Chowli Dry', 13, 1, 0.000, NULL, 105.00, NULL, NULL, NULL, '2026-03-08 15:58:27', '2026-03-08 15:58:27'),
(106, 'Chat Masala', 13, 1, 0.000, NULL, 560.00, NULL, NULL, NULL, '2026-03-08 15:59:04', '2026-03-08 15:59:04'),
(107, 'Besan', 13, 1, 0.000, NULL, 95.00, NULL, NULL, NULL, '2026-03-08 16:03:33', '2026-03-08 16:03:33'),
(108, 'Kasturi Methi', 13, 1, 0.000, NULL, 260.00, NULL, NULL, NULL, '2026-03-08 16:03:52', '2026-03-08 16:03:52'),
(109, 'Black Salt', 13, 1, 0.000, NULL, 30.00, NULL, NULL, NULL, '2026-03-08 16:04:12', '2026-03-08 16:04:12'),
(110, 'Badi Elahchi', 13, 1, 0.000, NULL, 550.00, NULL, NULL, NULL, '2026-03-08 16:04:59', '2026-03-08 16:04:59'),
(111, 'Laung', 13, 1, 0.000, 0.100, 820.00, 0.00, '', '', '2026-03-08 16:14:41', '2026-03-10 08:03:39'),
(112, 'Dhaniya Whole', 13, 1, 0.000, 1.000, 156.00, 0.00, '', '', '2026-03-08 16:15:02', '2026-03-10 08:01:32'),
(113, 'Bread Crum', 13, 1, 0.000, NULL, 130.00, NULL, NULL, NULL, '2026-03-08 16:15:20', '2026-03-08 16:15:20'),
(114, 'Ghoda Masala', 13, 1, 0.000, NULL, 370.00, NULL, NULL, NULL, '2026-03-08 16:16:06', '2026-03-08 16:16:06'),
(115, 'Ajwain', 13, 1, 0.000, NULL, 190.00, NULL, NULL, NULL, '2026-03-08 16:16:24', '2026-03-08 16:16:24'),
(116, 'Kismis', 13, 1, 0.000, NULL, 600.00, NULL, NULL, NULL, '2026-03-08 16:16:38', '2026-03-08 16:16:38'),
(117, 'Kewda Water', 13, 5, 0.000, NULL, 150.00, NULL, NULL, NULL, '2026-03-08 16:17:00', '2026-03-08 16:17:14'),
(118, 'Rose Water', 13, 5, 0.000, NULL, 150.00, NULL, NULL, NULL, '2026-03-08 16:17:30', '2026-03-08 16:17:30'),
(119, 'Till', 13, 1, 0.000, NULL, 160.00, NULL, NULL, NULL, '2026-03-08 16:17:50', '2026-03-08 16:17:50'),
(120, 'Boondi', 13, 1, 0.000, NULL, 160.00, NULL, NULL, NULL, '2026-03-08 16:18:13', '2026-03-08 16:18:13'),
(121, 'Badi Sauf', 13, 1, 0.000, NULL, 207.00, NULL, NULL, NULL, '2026-03-08 18:13:42', '2026-03-08 18:13:42'),
(124, 'Square 500ml', 18, 7, 0.000, NULL, 7.00, NULL, NULL, NULL, '2026-03-08 19:26:39', '2026-03-08 19:27:19'),
(125, 'Paper Bag Parcel', 18, 7, 0.000, NULL, 2.00, NULL, NULL, NULL, '2026-03-08 19:27:04', '2026-03-08 19:27:04'),
(127, 'Garam Masala Master', 17, 2, 0.000, NULL, 1.01, 1.01, NULL, 'Recipe Master id=7', '2026-03-10 08:00:36', '2026-03-11 15:03:08'),
(128, 'Paneer Tikka Masala Mixture', 17, 2, 0.000, NULL, 0.17, 0.17, NULL, 'Recipe Master id=8', '2026-03-10 08:39:10', '2026-03-11 15:02:57'),
(129, 'Sabji Masala Mixture Master', 17, 8, 0.000, NULL, 30.63, 30.63, NULL, 'Recipe Master id=12', '2026-03-11 15:14:54', '2026-03-11 15:15:51'),
(130, 'Tomato Gray Master', 17, 1, 0.000, NULL, 46.17, 46.17, NULL, 'Recipe Master id=13', '2026-03-11 15:21:17', '2026-03-11 15:21:17'),
(131, 'Onion Gravy Master', 17, 1, 0.000, NULL, 19.85, 19.85, NULL, 'Recipe Master id=14', '2026-03-11 15:24:51', '2026-03-11 15:24:51'),
(132, 'Kadhai Mixture Master', 17, 8, 0.000, NULL, 8.34, 8.34, NULL, 'Recipe Master id=15', '2026-03-11 15:28:54', '2026-03-11 15:28:54'),
(133, 'Mix Veg Mixture Master', 17, 8, 0.000, NULL, 27.23, 27.23, NULL, 'Recipe Master id=16', '2026-03-11 15:32:22', '2026-03-11 15:32:22'),
(134, 'Malai Tikka Mixture Master', 17, 2, 0.000, NULL, 0.24, 0.24, NULL, 'Recipe Master id=17', '2026-03-11 15:36:18', '2026-03-11 15:36:18'),
(135, 'Dal Fry Mixture', 17, 8, 0.000, NULL, 41.47, 41.47, NULL, 'Recipe Master id=18', '2026-03-11 15:40:31', '2026-03-11 15:40:31'),
(136, 'Dal Makhani Mixture', 17, 8, 0.000, NULL, 3.93, 3.93, NULL, 'Recipe Master id=19', '2026-03-11 15:49:53', '2026-03-11 15:49:53'),
(137, 'Boiled Rice Mixture', 17, 8, 0.000, NULL, 23.78, 23.78, NULL, 'Recipe Master id=20', '2026-03-11 15:51:56', '2026-03-11 15:51:56'),
(138, 'Boiled Biriyani Rice master', 17, 8, 0.000, NULL, 29.87, 29.87, NULL, 'Recipe Master id=21', '2026-03-11 15:52:55', '2026-03-11 15:52:55'),
(139, 'Paneer Tikka Starter Master', 17, 7, 0.000, NULL, 9.22, 9.22, NULL, 'Recipe Master id=22', '2026-03-11 16:36:46', '2026-03-11 16:36:46');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_movements`
--

CREATE TABLE `inventory_movements` (
  `id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `movement_type` enum('purchase','sale_deduction','manual_add','manual_remove','wastage') NOT NULL,
  `quantity_change` decimal(12,4) NOT NULL,
  `quantity_before` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `quantity_after` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `reference_type` varchar(30) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_purchases`
--

CREATE TABLE `inventory_purchases` (
  `id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `purchase_date` date NOT NULL,
  `supplier` varchar(150) DEFAULT NULL,
  `invoice_no` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `purchased_by` int(11) DEFAULT NULL COMMENT 'user id',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inventory_purchases`
--

INSERT INTO `inventory_purchases` (`id`, `inventory_item_id`, `quantity`, `price_per_unit`, `total_amount`, `purchase_date`, `supplier`, `invoice_no`, `notes`, `purchased_by`, `created_at`) VALUES
(1, 57, 1.000, 380.00, 380.00, '2026-03-09', 'Grocery', NULL, 'PO: PO-29990669', 3, '2026-03-09 04:20:03');

-- --------------------------------------------------------

--
-- Table structure for table `kot_items`
--

CREATE TABLE `kot_items` (
  `id` int(11) NOT NULL,
  `kot_id` int(11) NOT NULL,
  `order_item_id` int(11) NOT NULL,
  `item_name` varchar(150) DEFAULT NULL,
  `quantity` int(11) DEFAULT 1,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kot_tickets`
--

CREATE TABLE `kot_tickets` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `table_id` int(11) DEFAULT NULL,
  `kot_number` varchar(30) NOT NULL,
  `instructions` text DEFAULT NULL,
  `status` enum('pending','preparing','ready','served') DEFAULT 'pending',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `login_logs`
--

CREATE TABLE `login_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `status` enum('success','failed') DEFAULT 'success',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `login_logs`
--

INSERT INTO `login_logs` (`id`, `user_id`, `ip_address`, `status`, `created_at`) VALUES
(1, 3, '::1', 'success', '2026-03-08 08:30:49'),
(3, 3, '::1', 'success', '2026-03-08 12:32:01'),
(4, 3, '::1', 'success', '2026-03-08 14:17:30'),
(5, 3, '::1', 'success', '2026-03-08 16:21:32'),
(7, 3, '::1', 'success', '2026-03-08 16:22:15'),
(8, 3, '::ffff:192.168.1.12', 'success', '2026-03-08 18:12:42'),
(9, 3, '::ffff:192.168.1.12', 'success', '2026-03-09 02:31:32'),
(10, 3, '::ffff:192.168.1.12', 'success', '2026-03-09 03:05:46'),
(11, 3, '192.168.1.12', 'success', '2026-03-09 03:36:43'),
(12, 3, '127.0.0.1', 'success', '2026-03-09 03:37:37'),
(13, 3, '127.0.0.1', 'success', '2026-03-09 03:57:38'),
(14, 3, '127.0.0.1', 'success', '2026-03-09 03:58:33'),
(15, 3, '127.0.0.1', 'success', '2026-03-09 04:02:09'),
(16, 3, '127.0.0.1', 'success', '2026-03-09 04:04:38'),
(17, 3, '127.0.0.1', 'success', '2026-03-09 04:06:41'),
(18, 3, '127.0.0.1', 'success', '2026-03-09 04:13:10'),
(19, 3, '127.0.0.1', 'success', '2026-03-09 04:18:46'),
(20, 3, '127.0.0.1', 'success', '2026-03-09 04:23:39'),
(21, 3, '127.0.0.1', 'success', '2026-03-09 04:25:14'),
(22, 3, '127.0.0.1', 'success', '2026-03-09 04:38:43'),
(23, 3, '127.0.0.1', 'success', '2026-03-09 04:43:22'),
(24, 3, '127.0.0.1', 'success', '2026-03-09 09:04:00'),
(25, 3, '127.0.0.1', 'success', '2026-03-09 09:12:34'),
(26, 3, '127.0.0.1', 'success', '2026-03-09 09:16:44'),
(27, 3, '127.0.0.1', 'success', '2026-03-09 09:36:47'),
(28, 3, '127.0.0.1', 'success', '2026-03-09 09:50:51'),
(29, 3, '127.0.0.1', 'success', '2026-03-09 10:22:40'),
(31, 3, '127.0.0.1', 'success', '2026-03-09 10:42:42'),
(32, 3, '127.0.0.1', 'success', '2026-03-09 10:50:39'),
(33, 3, '127.0.0.1', 'success', '2026-03-09 13:32:00'),
(34, 3, '127.0.0.1', 'success', '2026-03-09 13:32:28'),
(35, 3, '127.0.0.1', 'success', '2026-03-09 13:35:23'),
(37, 3, '127.0.0.1', 'success', '2026-03-09 13:35:34'),
(38, 3, '127.0.0.1', 'success', '2026-03-09 13:41:08'),
(39, 3, '127.0.0.1', 'success', '2026-03-09 13:42:10'),
(40, 3, '127.0.0.1', 'success', '2026-03-09 13:42:29'),
(41, 3, '127.0.0.1', 'success', '2026-03-09 13:47:13'),
(42, 3, '127.0.0.1', 'success', '2026-03-09 13:47:35'),
(44, 3, '127.0.0.1', 'success', '2026-03-09 13:50:47'),
(45, 3, '127.0.0.1', 'success', '2026-03-09 13:55:22'),
(46, 3, '127.0.0.1', 'success', '2026-03-09 14:04:59'),
(47, 3, '127.0.0.1', 'success', '2026-03-09 14:06:12'),
(48, 3, '127.0.0.1', 'success', '2026-03-09 14:22:13'),
(49, 3, '127.0.0.1', 'success', '2026-03-09 14:27:17'),
(50, 3, '127.0.0.1', 'success', '2026-03-09 14:27:46'),
(51, 3, '127.0.0.1', 'success', '2026-03-09 14:32:34'),
(52, 3, '127.0.0.1', 'success', '2026-03-09 14:35:09'),
(53, 3, '127.0.0.1', 'success', '2026-03-09 14:42:04'),
(54, 3, '127.0.0.1', 'success', '2026-03-09 14:42:32'),
(55, 3, '127.0.0.1', 'success', '2026-03-09 14:52:13'),
(56, 3, '127.0.0.1', 'success', '2026-03-09 14:53:32'),
(57, 3, '127.0.0.1', 'success', '2026-03-09 14:56:53'),
(58, 3, '127.0.0.1', 'success', '2026-03-09 14:58:34'),
(59, 3, '127.0.0.1', 'success', '2026-03-09 15:03:48'),
(60, 3, '127.0.0.1', 'success', '2026-03-09 15:06:53'),
(62, 3, '127.0.0.1', 'success', '2026-03-09 15:45:44'),
(63, 3, '127.0.0.1', 'success', '2026-03-09 17:57:30'),
(64, 3, '127.0.0.1', 'success', '2026-03-09 18:18:20'),
(65, 3, '127.0.0.1', 'success', '2026-03-09 18:19:08'),
(66, 3, '127.0.0.1', 'success', '2026-03-09 18:20:59'),
(67, 3, '127.0.0.1', 'success', '2026-03-09 18:27:59'),
(68, 3, '127.0.0.1', 'success', '2026-03-09 18:30:55'),
(69, 3, '127.0.0.1', 'success', '2026-03-09 18:41:12'),
(70, 3, '127.0.0.1', 'success', '2026-03-09 18:48:13'),
(71, 3, '127.0.0.1', 'success', '2026-03-10 02:27:13'),
(72, 3, '127.0.0.1', 'success', '2026-03-10 02:33:24'),
(73, 3, '127.0.0.1', 'success', '2026-03-10 02:38:46'),
(74, 3, '127.0.0.1', 'success', '2026-03-10 02:55:18'),
(75, 3, '127.0.0.1', 'success', '2026-03-10 04:08:00'),
(76, 3, '127.0.0.1', 'success', '2026-03-10 04:15:51'),
(77, 3, '127.0.0.1', 'success', '2026-03-10 04:18:47'),
(78, 3, '127.0.0.1', 'success', '2026-03-10 04:24:26'),
(79, 3, '127.0.0.1', 'success', '2026-03-10 05:03:51'),
(80, 3, '127.0.0.1', 'success', '2026-03-10 05:11:52'),
(82, 3, '127.0.0.1', 'success', '2026-03-10 07:10:19'),
(83, 3, '127.0.0.1', 'success', '2026-03-10 07:14:34'),
(84, 3, '127.0.0.1', 'success', '2026-03-10 07:25:23'),
(85, 3, '127.0.0.1', 'success', '2026-03-10 07:32:18'),
(86, 3, '127.0.0.1', 'success', '2026-03-10 07:40:55'),
(87, 3, '127.0.0.1', 'success', '2026-03-10 07:42:52'),
(88, 3, '127.0.0.1', 'success', '2026-03-10 07:48:50'),
(89, 3, '127.0.0.1', 'success', '2026-03-10 08:07:40'),
(90, 3, '127.0.0.1', 'success', '2026-03-10 08:19:12'),
(91, 3, '127.0.0.1', 'success', '2026-03-10 08:20:04'),
(92, 3, '127.0.0.1', 'success', '2026-03-10 08:23:17'),
(93, 3, '127.0.0.1', 'success', '2026-03-10 08:29:39'),
(94, 3, '127.0.0.1', 'success', '2026-03-10 09:07:35'),
(95, 3, '127.0.0.1', 'success', '2026-03-10 09:19:28'),
(96, 3, '127.0.0.1', 'success', '2026-03-10 13:44:25'),
(97, 3, '192.168.1.20', 'success', '2026-03-10 13:48:03'),
(98, 3, '127.0.0.1', 'success', '2026-03-10 14:50:16'),
(99, 3, '192.168.31.99', 'success', '2026-03-10 14:50:25'),
(100, 3, '127.0.0.1', 'success', '2026-03-10 18:48:24'),
(101, 3, '192.168.1.22', 'success', '2026-03-10 19:15:06'),
(102, 3, '192.168.1.22', 'success', '2026-03-11 03:21:13'),
(103, 3, '127.0.0.1', 'success', '2026-03-11 05:09:32'),
(104, 3, '127.0.0.1', 'success', '2026-03-11 08:24:14'),
(105, 3, '127.0.0.1', 'success', '2026-03-11 08:27:45'),
(106, 3, '127.0.0.1', 'success', '2026-03-11 08:33:55'),
(107, 3, '127.0.0.1', 'success', '2026-03-11 08:40:24'),
(108, 3, '127.0.0.1', 'success', '2026-03-11 08:45:21'),
(109, 3, '127.0.0.1', 'success', '2026-03-11 11:05:12'),
(110, 3, '192.168.1.23', 'success', '2026-03-11 11:13:02'),
(111, 3, '192.168.1.23', 'success', '2026-03-11 11:28:55'),
(112, 3, '172.20.10.2', 'success', '2026-03-11 12:08:59'),
(113, 3, '172.20.10.2', 'success', '2026-03-11 12:19:18'),
(114, 3, '127.0.0.1', 'success', '2026-03-11 12:31:47'),
(115, 3, '127.0.0.1', 'success', '2026-03-11 12:53:21'),
(116, 3, '192.168.1.23', 'success', '2026-03-11 12:55:47'),
(117, 3, '192.168.31.99', 'success', '2026-03-11 14:53:31'),
(118, 3, '127.0.0.1', 'success', '2026-03-11 14:58:29'),
(119, 3, '127.0.0.1', 'success', '2026-03-12 03:25:52'),
(120, 3, '127.0.0.1', 'success', '2026-03-12 03:28:00'),
(121, 3, '127.0.0.1', 'success', '2026-03-12 03:32:23'),
(122, 3, '127.0.0.1', 'success', '2026-03-12 03:39:55'),
(123, 3, '127.0.0.1', 'success', '2026-03-12 03:44:22'),
(124, 3, '127.0.0.1', 'success', '2026-03-12 03:54:56'),
(125, 3, '127.0.0.1', 'success', '2026-03-12 04:00:49'),
(126, 3, '127.0.0.1', 'success', '2026-03-12 04:10:22'),
(127, 3, '127.0.0.1', 'success', '2026-03-12 04:55:51'),
(128, 3, '127.0.0.1', 'success', '2026-03-12 04:56:18');

-- --------------------------------------------------------

--
-- Table structure for table `menu_courses`
--

CREATE TABLE `menu_courses` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(10) DEFAULT '?️',
  `color` varchar(20) DEFAULT '#e8572a',
  `description` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `menu_courses`
--

INSERT INTO `menu_courses` (`id`, `name`, `icon`, `color`, `description`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Starter', '🥗', '#4cc9f0', NULL, 1, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(2, 'Main Course', '🍛', '#e8572a', NULL, 2, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(3, 'Bread', '🫓', '#fb5607', NULL, 3, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(4, 'Dessert', '🍮', '#f4a535', NULL, 4, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(5, 'Beverage', '🥤', '#3a86ff', NULL, 5, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(6, 'Snack', '🍿', '#7b5ea7', NULL, 6, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38'),
(7, 'Other', '📦', '#5a5a78', NULL, 7, 1, '2026-03-08 17:12:38', '2026-03-08 17:12:38');

-- --------------------------------------------------------

--
-- Table structure for table `menu_items`
--

CREATE TABLE `menu_items` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `recipe_id` int(11) DEFAULT NULL,
  `selling_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cost_price` decimal(10,2) DEFAULT NULL COMMENT 'Auto-filled from menu_recipe.cost_per_portion if set',
  `gst_percent` decimal(5,2) NOT NULL DEFAULT 5.00,
  `is_veg` tinyint(1) NOT NULL DEFAULT 1,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `auto_sync_cost` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = auto-update cost_price from linked recipe when recipe changes',
  `price_with_gst` decimal(10,2) DEFAULT NULL,
  `discount_applicable` tinyint(1) DEFAULT 1,
  `is_parcel_available` tinyint(1) DEFAULT 1,
  `price_includes_gst` tinyint(1) DEFAULT 0,
  `inventory_item_id` int(11) DEFAULT NULL,
  `qty_per_sale` decimal(10,4) DEFAULT 1.0000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `menu_items`
--

INSERT INTO `menu_items` (`id`, `name`, `course_id`, `recipe_id`, `selling_price`, `cost_price`, `gst_percent`, `is_veg`, `description`, `is_active`, `created_at`, `updated_at`, `auto_sync_cost`, `price_with_gst`, `discount_applicable`, `is_parcel_available`, `price_includes_gst`, `inventory_item_id`, `qty_per_sale`) VALUES
(8, 'Paneer Tikka Starter', 1, 23, 199.00, 73.76, 5.00, 1, NULL, 1, '2026-03-11 16:40:57', '2026-03-11 16:41:04', 1, 208.95, 1, 1, 0, 139, 8.0000);

-- --------------------------------------------------------

--
-- Table structure for table `menu_recipes`
--

CREATE TABLE `menu_recipes` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `course` enum('Starter','Main Course','Bread','Dessert','Beverage','Snack','Other') NOT NULL DEFAULT 'Main Course',
  `serves` decimal(8,3) NOT NULL DEFAULT 1.000 COMMENT 'Number of portions this recipe makes',
  `description` text DEFAULT NULL,
  `total_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cost_per_portion` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `menu_recipe_items`
--

CREATE TABLE `menu_recipe_items` (
  `id` int(11) NOT NULL,
  `menu_recipe_id` int(11) NOT NULL,
  `source_type` enum('inv','recipe') NOT NULL DEFAULT 'inv' COMMENT '"inv" = inventory_items, "recipe" = recipes (Recipe Master)',
  `source_id` int(11) NOT NULL COMMENT 'FK to inventory_items.id or recipes.id',
  `quantity` decimal(12,3) NOT NULL,
  `price_per_unit` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `line_cost` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `table_id` int(11) DEFAULT NULL,
  `order_type` enum('dine_in','parcel','takeaway') DEFAULT 'dine_in',
  `status` enum('open','kot','billed','paid','cancelled') DEFAULT 'open',
  `customer_name` varchar(100) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `subtotal` decimal(10,2) DEFAULT 0.00,
  `gst_amount` decimal(10,2) DEFAULT 0.00,
  `discount_type` enum('percentage','amount','coupon') DEFAULT NULL,
  `discount_value` decimal(10,2) DEFAULT 0.00,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `coupon_id` int(11) DEFAULT NULL,
  `coupon_code` varchar(50) DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `payment_method` enum('cash','card','upi','other') DEFAULT NULL,
  `payment_status` enum('pending','paid') DEFAULT 'pending',
  `kot_instructions` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `billed_by` int(11) DEFAULT NULL,
  `billed_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `item_name` varchar(150) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `gst_percent` decimal(5,2) DEFAULT 0.00,
  `gst_amount` decimal(10,2) DEFAULT 0.00,
  `total_price` decimal(10,2) NOT NULL,
  `kot_sent` tinyint(1) DEFAULT 0,
  `kot_instructions` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` int(11) NOT NULL,
  `po_number` varchar(30) NOT NULL,
  `supplier` varchar(150) DEFAULT NULL,
  `supplier_phone` varchar(20) DEFAULT NULL,
  `supplier_address` text DEFAULT NULL,
  `expected_date` date DEFAULT NULL,
  `status` enum('pending','partial','received','cancelled') DEFAULT 'pending',
  `total_amount` decimal(12,2) DEFAULT 0.00,
  `bill_amount` decimal(12,2) DEFAULT NULL,
  `invoice_no` varchar(80) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `receive_notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `received_by` int(11) DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `unit_id` int(11) DEFAULT NULL,
  `ordered_qty` decimal(12,3) NOT NULL,
  `received_qty` decimal(12,3) DEFAULT 0.000,
  `unit_price` decimal(12,4) DEFAULT 0.0000,
  `total_price` decimal(12,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `recipes`
--

CREATE TABLE `recipes` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `yield_qty` decimal(12,3) NOT NULL DEFAULT 1.000 COMMENT 'How much this recipe produces',
  `yield_unit_id` int(11) DEFAULT NULL,
  `total_cost` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Sum of all ingredient costs',
  `cost_per_unit` decimal(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'total_cost / yield_qty',
  `inventory_item_ref` int(11) DEFAULT NULL COMMENT 'Linked inventory_items.id (Recipe Master category)',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_master` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = Recipe Master (saved to inventory), 0 = Menu Recipe',
  `serves` decimal(8,3) DEFAULT NULL COMMENT 'Number of portions for menu recipes',
  `course_id` int(11) DEFAULT NULL COMMENT 'FK → menu_courses.id (for menu recipes)',
  `unit_id` int(11) DEFAULT NULL COMMENT 'Chosen unit per ingredient line (in recipe_items)',
  `cook_minutes` int(11) NOT NULL DEFAULT 0 COMMENT 'Total cook/prep time in minutes',
  `wastage_percent` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Wastage/error % applied to ingredient cost',
  `salary_profile_id` int(11) DEFAULT NULL COMMENT 'FK → salary_profiles.id',
  `fuel_profile_id` int(11) DEFAULT NULL COMMENT 'FK → fuel_profiles.id',
  `ingredient_cost` decimal(12,2) DEFAULT NULL,
  `wastage_cost` decimal(12,2) DEFAULT NULL,
  `salary_cost` decimal(12,2) DEFAULT NULL,
  `fuel_cost` decimal(12,2) DEFAULT NULL,
  `salary_total_cost` decimal(12,2) DEFAULT 0.00 COMMENT 'Sum of all staff line costs for this recipe'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recipes`
--

INSERT INTO `recipes` (`id`, `name`, `description`, `yield_qty`, `yield_unit_id`, `total_cost`, `cost_per_unit`, `inventory_item_ref`, `is_active`, `created_at`, `updated_at`, `is_master`, `serves`, `course_id`, `unit_id`, `cook_minutes`, `wastage_percent`, `salary_profile_id`, `fuel_profile_id`, `ingredient_cost`, `wastage_cost`, `salary_cost`, `fuel_cost`, `salary_total_cost`) VALUES
(7, 'Garam Masala Master', 'Garam masala to add into all recipe', 2250.000, 2, 2273.25, 1.0103, NULL, 1, '2026-03-10 08:00:36', '2026-03-10 15:42:39', 1, NULL, NULL, NULL, 30, 0.00, NULL, NULL, 2210.75, 0.00, NULL, 0.00, 62.50),
(8, 'Paneer Tikka Masala Mixture', NULL, 1400.000, 2, 238.85, 0.1706, NULL, 1, '2026-03-10 08:39:10', '2026-03-11 15:02:57', 1, NULL, NULL, NULL, 15, 2.00, NULL, NULL, 212.11, 4.24, NULL, 0.00, 22.50),
(12, 'Sabji Masala Mixture Master', NULL, 1.000, 8, 30.63, 30.6326, NULL, 1, '2026-03-11 15:14:54', '2026-03-11 15:15:51', 1, NULL, NULL, NULL, 1, 2.00, NULL, NULL, 30.03, 0.60, NULL, 0.00, 0.00),
(13, 'Tomato Gray Master', NULL, 80.000, 1, 3693.31, 46.1664, NULL, 1, '2026-03-11 15:21:17', '2026-03-11 15:21:17', 1, NULL, NULL, NULL, 180, 0.00, NULL, 1, 2949.45, 0.00, NULL, 556.36, 187.50),
(14, 'Onion Gravy Master', NULL, 180.000, 1, 3573.31, 19.8517, NULL, 1, '2026-03-11 15:24:51', '2026-03-11 15:24:51', 1, NULL, NULL, NULL, 180, 0.00, NULL, 1, 2829.45, 0.00, NULL, 556.36, 187.50),
(15, 'Kadhai Mixture Master', NULL, 10.000, 8, 83.43, 8.3434, NULL, 1, '2026-03-11 15:28:54', '2026-03-11 15:28:54', 1, NULL, NULL, NULL, 4, 0.00, NULL, 1, 71.07, 0.00, NULL, 12.36, 0.00),
(16, 'Mix Veg Mixture Master', NULL, 12.000, 8, 326.73, 27.2273, NULL, 1, '2026-03-11 15:32:22', '2026-03-11 15:32:22', 1, NULL, NULL, NULL, 30, 4.00, NULL, 1, 225.00, 9.00, NULL, 92.73, 0.00),
(17, 'Malai Tikka Mixture Master', NULL, 1400.000, 2, 332.87, 0.2378, NULL, 1, '2026-03-11 15:36:17', '2026-03-11 15:36:17', 1, NULL, NULL, NULL, 15, 0.00, NULL, 1, 264.00, 0.00, NULL, 46.36, 22.50),
(18, 'Dal Fry Mixture', NULL, 1.000, 8, 41.47, 41.4670, NULL, 1, '2026-03-11 15:40:31', '2026-03-11 15:40:31', 1, NULL, NULL, NULL, 3, 5.00, NULL, 1, 27.69, 1.38, NULL, 9.27, 3.13),
(19, 'Dal Makhani Mixture', NULL, 114.000, 8, 447.53, 3.9257, NULL, 1, '2026-03-11 15:49:53', '2026-03-11 15:49:53', 1, NULL, NULL, NULL, 30, 5.00, NULL, 1, 308.15, 15.41, NULL, 92.73, 31.25),
(20, 'Boiled Rice Mixture', NULL, 5.000, 8, 118.92, 23.7837, NULL, 1, '2026-03-11 15:51:56', '2026-03-11 15:51:56', 1, NULL, NULL, NULL, 15, 5.00, NULL, 1, 69.10, 3.46, NULL, 46.36, 0.00),
(21, 'Boiled Biriyani Rice master', NULL, 5.000, 8, 149.37, 29.8737, NULL, 1, '2026-03-11 15:52:55', '2026-03-11 15:52:55', 1, NULL, NULL, NULL, 15, 5.00, NULL, 1, 98.10, 4.91, NULL, 46.36, 0.00),
(22, 'Paneer Tikka Starter Master', NULL, 8.000, 7, 73.74, 9.2177, NULL, 1, '2026-03-11 16:36:46', '2026-03-11 16:36:46', 1, NULL, NULL, NULL, 5, 4.00, NULL, 2, 57.93, 2.32, NULL, 6.00, 7.50),
(23, 'Paneer Tikka Starter', NULL, 1.000, NULL, 73.76, 73.7600, NULL, 1, '2026-03-11 16:37:31', '2026-03-11 16:37:31', 0, 1.000, 1, NULL, 0, 0.00, NULL, NULL, 73.76, 0.00, NULL, 0.00, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `recipe_items`
--

CREATE TABLE `recipe_items` (
  `id` int(11) NOT NULL,
  `recipe_id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `price_per_unit` decimal(10,4) NOT NULL DEFAULT 0.0000 COMMENT 'Snapshot of purchase_price at time of save',
  `line_cost` decimal(12,4) NOT NULL DEFAULT 0.0000 COMMENT 'quantity × price_per_unit',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `unit_id` int(11) DEFAULT NULL COMMENT 'Unit chosen at time of adding ingredient (may differ from item base unit)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recipe_items`
--

INSERT INTO `recipe_items` (`id`, `recipe_id`, `inventory_item_id`, `quantity`, `price_per_unit`, `line_cost`, `created_at`, `unit_id`) VALUES
(486, 8, 10, 2.000, 67.0000, 134.0000, '2026-03-11 15:02:57', 1),
(487, 8, 60, 15.000, 0.0290, 0.4350, '2026-03-11 15:02:57', 2),
(488, 8, 109, 10.000, 0.0300, 0.3000, '2026-03-11 15:02:57', 2),
(489, 8, 74, 100.000, 0.1750, 17.5000, '2026-03-11 15:02:57', 6),
(490, 8, 57, 20.000, 0.3800, 7.6000, '2026-03-11 15:02:57', 2),
(491, 8, 58, 10.000, 0.3450, 3.4500, '2026-03-11 15:02:57', 2),
(492, 8, 54, 10.000, 0.3000, 3.0000, '2026-03-11 15:02:57', 2),
(493, 8, 108, 5.000, 0.2600, 1.3000, '2026-03-11 15:02:57', 2),
(494, 8, 106, 5.000, 0.5600, 2.8000, '2026-03-11 15:02:57', 2),
(495, 8, 127, 10.000, 1.0100, 10.1000, '2026-03-11 15:02:57', 2),
(496, 8, 61, 2.000, 0.0600, 0.1200, '2026-03-11 15:02:57', 2),
(497, 8, 18, 150.000, 0.0700, 10.5000, '2026-03-11 15:02:57', 2),
(498, 8, 17, 150.000, 0.1400, 21.0000, '2026-03-11 15:02:57', 2),
(499, 7, 63, 250.000, 3.3000, 825.0000, '2026-03-11 15:03:08', 2),
(500, 7, 110, 200.000, 0.5500, 110.0000, '2026-03-11 15:03:08', 2),
(501, 7, 86, 200.000, 1.0000, 200.0000, '2026-03-11 15:03:08', 2),
(502, 7, 92, 100.000, 0.2000, 20.0000, '2026-03-11 15:03:08', 2),
(503, 7, 87, 300.000, 0.4000, 120.0000, '2026-03-11 15:03:08', 2),
(504, 7, 84, 250.000, 0.2800, 70.0000, '2026-03-11 15:03:08', 2),
(505, 7, 103, 200.000, 1.6000, 320.0000, '2026-03-11 15:03:08', 2),
(506, 7, 90, 250.000, 1.0000, 250.0000, '2026-03-11 15:03:08', 2),
(507, 7, 111, 250.000, 0.8200, 205.0000, '2026-03-11 15:03:08', 2),
(508, 7, 121, 250.000, 0.2070, 51.7500, '2026-03-11 15:03:08', 2),
(509, 7, 112, 250.000, 0.1560, 39.0000, '2026-03-11 15:03:08', 2),
(523, 12, 57, 3.000, 0.3800, 1.1400, '2026-03-11 15:15:51', 2),
(524, 12, 60, 3.000, 0.0290, 0.0870, '2026-03-11 15:15:51', 2),
(525, 12, 58, 3.000, 0.3450, 1.0350, '2026-03-11 15:15:51', 2),
(526, 12, 54, 2.000, 0.3000, 0.6000, '2026-03-11 15:15:51', 2),
(527, 12, 6, 20.000, 0.2600, 5.2000, '2026-03-11 15:15:51', 2),
(528, 12, 59, 20.000, 0.1550, 3.1000, '2026-03-11 15:15:51', 2),
(529, 12, 13, 40.000, 0.2250, 9.0000, '2026-03-11 15:15:51', 6),
(530, 12, 4, 20.000, 0.1860, 3.7200, '2026-03-11 15:15:51', 2),
(531, 12, 108, 3.000, 0.2600, 0.7800, '2026-03-11 15:15:51', 2),
(532, 12, 83, 2.000, 0.7500, 1.5000, '2026-03-11 15:15:51', 2),
(533, 12, 127, 2.000, 1.0100, 2.0200, '2026-03-11 15:15:51', 2),
(534, 12, 26, 5.000, 0.0900, 0.4500, '2026-03-11 15:15:51', 2),
(535, 12, 17, 10.000, 0.1400, 1.4000, '2026-03-11 15:15:51', 2),
(536, 13, 49, 800.000, 0.9000, 720.0000, '2026-03-11 15:21:17', 2),
(537, 13, 79, 800.000, 0.6400, 512.0000, '2026-03-11 15:21:17', 2),
(538, 13, 17, 400.000, 0.1400, 56.0000, '2026-03-11 15:21:17', 2),
(539, 13, 18, 400.000, 0.0700, 28.0000, '2026-03-11 15:21:17', 2),
(540, 13, 52, 100.000, 0.4000, 40.0000, '2026-03-11 15:21:17', 2),
(541, 13, 60, 400.000, 0.0290, 11.6000, '2026-03-11 15:21:17', 2),
(542, 13, 57, 50.000, 0.3800, 19.0000, '2026-03-11 15:21:17', 2),
(543, 13, 58, 50.000, 0.3450, 17.2500, '2026-03-11 15:21:17', 2),
(544, 13, 48, 50.000, 0.4100, 20.5000, '2026-03-11 15:21:17', 2),
(545, 13, 63, 30.000, 3.3000, 99.0000, '2026-03-11 15:21:17', 2),
(546, 13, 110, 30.000, 0.5500, 16.5000, '2026-03-11 15:21:17', 2),
(547, 13, 90, 30.000, 1.0000, 30.0000, '2026-03-11 15:21:17', 2),
(548, 13, 111, 30.000, 0.8200, 24.6000, '2026-03-11 15:21:17', 2),
(549, 13, 30, 60.000, 20.0000, 1200.0000, '2026-03-11 15:21:17', 1),
(550, 13, 59, 1.000, 155.0000, 155.0000, '2026-03-11 15:21:17', 5),
(551, 14, 49, 800.000, 0.9000, 720.0000, '2026-03-11 15:24:51', 2),
(552, 14, 79, 800.000, 0.6400, 512.0000, '2026-03-11 15:24:51', 2),
(553, 14, 17, 400.000, 0.1400, 56.0000, '2026-03-11 15:24:51', 2),
(554, 14, 18, 400.000, 0.0700, 28.0000, '2026-03-11 15:24:51', 2),
(555, 14, 52, 100.000, 0.4000, 40.0000, '2026-03-11 15:24:51', 2),
(556, 14, 60, 400.000, 0.0290, 11.6000, '2026-03-11 15:24:51', 2),
(557, 14, 57, 50.000, 0.3800, 19.0000, '2026-03-11 15:24:51', 2),
(558, 14, 58, 50.000, 0.3450, 17.2500, '2026-03-11 15:24:51', 2),
(559, 14, 48, 50.000, 0.4100, 20.5000, '2026-03-11 15:24:51', 2),
(560, 14, 63, 30.000, 3.3000, 99.0000, '2026-03-11 15:24:51', 2),
(561, 14, 110, 30.000, 0.5500, 16.5000, '2026-03-11 15:24:51', 2),
(562, 14, 90, 30.000, 1.0000, 30.0000, '2026-03-11 15:24:51', 2),
(563, 14, 111, 30.000, 0.8200, 24.6000, '2026-03-11 15:24:51', 2),
(564, 14, 24, 60.000, 18.0000, 1080.0000, '2026-03-11 15:24:51', 1),
(565, 14, 59, 1.000, 155.0000, 155.0000, '2026-03-11 15:24:51', 5),
(566, 15, 25, 500.000, 0.0150, 7.5000, '2026-03-11 15:28:54', 2),
(567, 15, 20, 500.000, 0.0500, 25.0000, '2026-03-11 15:28:54', 2),
(568, 15, 30, 500.000, 0.0200, 10.0000, '2026-03-11 15:28:54', 2),
(569, 15, 93, 10.000, 0.3600, 3.6000, '2026-03-11 15:28:54', 2),
(570, 15, 58, 10.000, 0.3450, 3.4500, '2026-03-11 15:28:54', 2),
(571, 15, 121, 10.000, 0.2070, 2.0700, '2026-03-11 15:28:54', 2),
(572, 15, 48, 5.000, 0.4100, 2.0500, '2026-03-11 15:28:54', 2),
(573, 15, 57, 5.000, 0.3800, 1.9000, '2026-03-11 15:28:54', 2),
(574, 15, 59, 100.000, 0.1550, 15.5000, '2026-03-11 15:28:54', 6),
(575, 16, 16, 1.000, 30.0000, 30.0000, '2026-03-11 15:32:22', 1),
(576, 16, 27, 1.000, 50.0000, 50.0000, '2026-03-11 15:32:22', 1),
(577, 16, 15, 2.000, 50.0000, 100.0000, '2026-03-11 15:32:22', 1),
(578, 16, 9, 500.000, 0.0900, 45.0000, '2026-03-11 15:32:22', 2),
(579, 17, 11, 60.000, 0.5400, 32.4000, '2026-03-11 15:36:17', 2),
(580, 17, 13, 150.000, 0.2250, 33.7500, '2026-03-11 15:36:17', 6),
(581, 17, 49, 60.000, 0.9000, 54.0000, '2026-03-11 15:36:17', 2),
(582, 17, 18, 20.000, 0.0700, 1.4000, '2026-03-11 15:36:17', 2),
(583, 17, 17, 20.000, 0.1400, 2.8000, '2026-03-11 15:36:17', 2),
(584, 17, 69, 5.000, 0.0420, 0.2100, '2026-03-11 15:36:18', 2),
(585, 17, 63, 1.000, 3.3000, 3.3000, '2026-03-11 15:36:18', 2),
(586, 17, 74, 5.000, 0.1750, 0.8750, '2026-03-11 15:36:18', 6),
(587, 17, 60, 3.000, 0.0290, 0.0870, '2026-03-11 15:36:18', 2),
(588, 17, 106, 2.000, 0.5600, 1.1200, '2026-03-11 15:36:18', 2),
(589, 17, 109, 2.000, 0.0300, 0.0600, '2026-03-11 15:36:18', 2),
(590, 17, 10, 2.000, 67.0000, 134.0000, '2026-03-11 15:36:18', 1),
(591, 18, 57, 3.000, 0.3800, 1.1400, '2026-03-11 15:40:31', 2),
(592, 18, 50, 70.000, 0.1380, 9.6600, '2026-03-11 15:40:31', 2),
(593, 18, 47, 10.000, 0.1150, 1.1500, '2026-03-11 15:40:31', 2),
(594, 18, 56, 70.000, 0.0850, 5.9500, '2026-03-11 15:40:31', 2),
(595, 18, 59, 30.000, 0.1550, 4.6500, '2026-03-11 15:40:31', 2),
(596, 18, 17, 10.000, 0.1400, 1.4000, '2026-03-11 15:40:31', 2),
(597, 18, 25, 15.000, 0.0150, 0.2250, '2026-03-11 15:40:31', 2),
(598, 18, 30, 15.000, 0.0200, 0.3000, '2026-03-11 15:40:31', 2),
(599, 18, 26, 5.000, 0.0900, 0.4500, '2026-03-11 15:40:31', 2),
(600, 18, 54, 3.000, 0.3000, 0.9000, '2026-03-11 15:40:31', 2),
(601, 18, 4, 10.000, 0.1860, 1.8600, '2026-03-11 15:40:31', 2),
(602, 19, 85, 1.000, 120.0000, 120.0000, '2026-03-11 15:49:53', 1),
(603, 19, 95, 700.000, 0.1200, 84.0000, '2026-03-11 15:49:53', 2),
(604, 19, 101, 400.000, 0.0900, 36.0000, '2026-03-11 15:49:53', 2),
(605, 19, 63, 10.000, 3.3000, 33.0000, '2026-03-11 15:49:53', 2),
(606, 19, 92, 5.000, 0.2000, 1.0000, '2026-03-11 15:49:53', 2),
(607, 19, 87, 10.000, 0.4000, 4.0000, '2026-03-11 15:49:53', 2),
(608, 19, 110, 10.000, 0.5500, 5.5000, '2026-03-11 15:49:53', 2),
(609, 19, 90, 5.000, 1.0000, 5.0000, '2026-03-11 15:49:53', 2),
(610, 19, 111, 5.000, 0.8200, 4.1000, '2026-03-11 15:49:53', 2),
(611, 19, 17, 15.000, 0.1400, 2.1000, '2026-03-11 15:49:53', 2),
(612, 19, 18, 15.000, 0.0700, 1.0500, '2026-03-11 15:49:53', 2),
(613, 19, 53, 15.000, 0.7000, 10.5000, '2026-03-11 15:49:53', 2),
(614, 19, 57, 5.000, 0.3800, 1.9000, '2026-03-11 15:49:53', 2),
(615, 20, 51, 1.000, 66.0000, 66.0000, '2026-03-11 15:51:56', 1),
(616, 20, 59, 20.000, 0.1550, 3.1000, '2026-03-11 15:51:56', 2),
(617, 21, 100, 1.000, 95.0000, 95.0000, '2026-03-11 15:52:55', 1),
(618, 21, 59, 20.000, 0.1550, 3.1000, '2026-03-11 15:52:55', 2),
(619, 22, 3, 150.000, 0.2150, 32.2500, '2026-03-11 16:36:46', 2),
(620, 22, 25, 15.000, 0.0150, 0.2250, '2026-03-11 16:36:46', 2),
(621, 22, 30, 15.000, 0.0200, 0.3000, '2026-03-11 16:36:46', 2),
(622, 22, 20, 15.000, 0.0500, 0.7500, '2026-03-11 16:36:46', 2),
(623, 22, 128, 80.000, 0.1700, 13.6000, '2026-03-11 16:36:46', 2),
(624, 22, 11, 20.000, 0.5400, 10.8000, '2026-03-11 16:36:46', 2),
(625, 23, 139, 8.000, 9.2200, 73.7600, '2026-03-11 16:37:31', 7);

-- --------------------------------------------------------

--
-- Table structure for table `recipe_salary_staff`
--

CREATE TABLE `recipe_salary_staff` (
  `id` int(11) NOT NULL,
  `recipe_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `salary_id` int(11) DEFAULT NULL,
  `staff_count` decimal(5,2) NOT NULL DEFAULT 1.00 COMMENT 'Number of staff of this role (can be fractional e.g. 0.5)',
  `per_minute` decimal(14,8) DEFAULT 0.00000000,
  `line_cost` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Pre-computed: per_minute × cook_minutes × staff_count'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recipe_salary_staff`
--

INSERT INTO `recipe_salary_staff` (`id`, `recipe_id`, `user_id`, `salary_id`, `staff_count`, `per_minute`, `line_cost`) VALUES
(18, 8, 19, NULL, 1.00, 1.50000000, 22.50),
(19, 7, 15, NULL, 1.00, 2.08333333, 62.50),
(20, 13, 16, NULL, 1.00, 1.04166667, 187.50),
(21, 14, 16, NULL, 1.00, 1.04166667, 187.50),
(22, 17, 19, NULL, 1.00, 1.50000000, 22.50),
(23, 18, 16, NULL, 1.00, 1.04166667, 3.13),
(24, 19, 16, NULL, 1.00, 1.04166667, 31.25),
(25, 22, 19, NULL, 1.00, 1.50000000, 7.50);

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_settings`
--

CREATE TABLE `restaurant_settings` (
  `id` int(11) NOT NULL DEFAULT 1,
  `restaurant_name` varchar(100) DEFAULT 'Tasteza Restaurant',
  `tagline` varchar(200) DEFAULT 'Thank you for dining with us!',
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `website` varchar(100) DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `fssai_number` varchar(20) DEFAULT NULL,
  `currency_symbol` varchar(5) DEFAULT '₹',
  `logo_base64` longtext DEFAULT NULL,
  `logo_width` int(11) DEFAULT 120,
  `bill_footer` text DEFAULT 'Have a great day! ?',
  `show_logo` tinyint(4) DEFAULT 1,
  `show_gst_break` tinyint(4) DEFAULT 1,
  `show_qr` tinyint(4) DEFAULT 1,
  `show_thank_you` tinyint(4) DEFAULT 1,
  `bill_copies` int(11) DEFAULT 1,
  `primary_color` varchar(10) DEFAULT '#e84a5f',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `restaurant_settings`
--

INSERT INTO `restaurant_settings` (`id`, `restaurant_name`, `tagline`, `address`, `phone`, `email`, `website`, `gst_number`, `fssai_number`, `currency_symbol`, `logo_base64`, `logo_width`, `bill_footer`, `show_logo`, `show_gst_break`, `show_qr`, `show_thank_you`, `bill_copies`, `primary_color`, `updated_at`) VALUES
(1, 'Tasteza Kitchen & Cafe', 'Thank you for dining with us!', '', '+91 7226081812', 'tastezakitchen@gmail.com', 'www.tastezakitchen.com', '', '', '₹', 'data:image/jpeg;base64,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', 120, 'Have a great day! ?', 1, 1, 1, 1, 1, '#e84a5f', '2026-03-09 14:46:33');

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_tables`
--

CREATE TABLE `restaurant_tables` (
  `id` int(11) NOT NULL,
  `table_number` varchar(20) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `capacity` int(11) DEFAULT 4,
  `section` varchar(50) DEFAULT 'Main Hall',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `restaurant_tables`
--

INSERT INTO `restaurant_tables` (`id`, `table_number`, `table_name`, `capacity`, `section`, `is_active`, `created_at`) VALUES
(1, 'T1', 'Table 1', 4, 'Main Hall', 0, '2026-03-09 09:05:03'),
(2, 'T2', 'Table 2', 4, 'Main Hall', 0, '2026-03-09 09:05:03'),
(3, 'T3', 'Table 3', 2, 'Main Hall', 0, '2026-03-09 09:05:03'),
(4, 'T4', 'Table 4', 6, 'Main Hall', 0, '2026-03-09 09:05:03'),
(5, 'T5', 'Table 5', 4, 'Main Hall', 0, '2026-03-09 09:05:03'),
(6, 'T6', 'Table 6', 4, 'Main Hall', 0, '2026-03-09 09:05:03'),
(7, 'T7', 'Table 7', 2, 'Outdoor', 1, '2026-03-09 09:05:03'),
(8, 'T8', 'Table 8', 4, 'Outdoor', 1, '2026-03-09 09:05:03'),
(9, 'T9', 'Table 9', 8, 'Private', 1, '2026-03-09 09:05:03'),
(10, 'T10', 'Table 10', 4, 'Bar', 0, '2026-03-09 09:05:03');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` int(11) NOT NULL,
  `role` varchar(30) NOT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`permissions`)),
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`id`, `role`, `permissions`, `updated_by`, `updated_at`) VALUES
(1, 'admin', '[\"*\"]', NULL, '2026-03-09 10:21:39'),
(2, 'manager', '[\"sales\",\"kot\",\"coupons\",\"inventory\",\"purchases\",\"purchaseorders\",\"recipes\",\"menuitems\",\"courses\",\"salary\",\"reports\",\"customers\",\"staff\"]', NULL, '2026-03-09 10:21:39'),
(3, 'waiter', '[\"sales\",\"kot\"]', NULL, '2026-03-09 10:21:39'),
(4, 'staff', '[\"sales\",\"kot\",\"inventory\"]', NULL, '2026-03-09 10:21:39');

-- --------------------------------------------------------

--
-- Table structure for table `salary_profiles`
--

CREATE TABLE `salary_profiles` (
  `id` int(11) NOT NULL,
  `role_name` varchar(100) NOT NULL,
  `salary_type` enum('monthly','hourly','daily','permin') NOT NULL DEFAULT 'monthly',
  `amount` decimal(12,2) NOT NULL,
  `hours_per_day` decimal(4,2) NOT NULL DEFAULT 8.00,
  `days_per_month` decimal(4,1) NOT NULL DEFAULT 26.0,
  `per_minute` decimal(12,6) NOT NULL DEFAULT 0.000000 COMMENT 'Auto-calculated ₹ per minute — used in recipe costing',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `salary_profiles`
--

INSERT INTO `salary_profiles` (`id`, `role_name`, `salary_type`, `amount`, `hours_per_day`, `days_per_month`, `per_minute`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'Head Chef', 'monthly', 30000.00, 10.00, 30.0, 1.666667, 'Experienced chef', '2026-03-08 19:11:15', '2026-03-08 19:17:21'),
(2, 'Kitchen Helper', 'monthly', 15000.00, 10.00, 30.0, 0.833333, 'Kitchen helper', '2026-03-08 19:11:15', '2026-03-08 19:17:43'),
(3, 'Tandoor Cook', 'monthly', 27000.00, 10.00, 30.0, 1.500000, 'Tandoor specialist', '2026-03-08 19:11:15', '2026-03-08 19:17:59'),
(4, 'Tandoor Helper', 'monthly', 15000.00, 10.00, 30.0, 0.833333, NULL, '2026-03-08 19:18:18', '2026-03-08 19:18:18'),
(5, 'Chinese Chef', 'monthly', 19000.00, 10.00, 30.0, 1.055556, NULL, '2026-03-08 19:18:36', '2026-03-08 19:18:36'),
(6, 'Cleaner', 'monthly', 12000.00, 10.00, 30.0, 0.666667, NULL, '2026-03-08 19:18:54', '2026-03-08 19:18:54'),
(7, 'Captain', 'monthly', 15000.00, 10.00, 30.0, 0.833333, NULL, '2026-03-08 19:19:20', '2026-03-08 19:19:20'),
(8, 'Waiter', 'monthly', 12000.00, 10.00, 30.0, 0.666667, NULL, '2026-03-08 19:19:32', '2026-03-08 19:19:32'),
(9, 'All Combine', 'monthly', 145000.00, 10.00, 30.0, 8.055556, NULL, '2026-03-08 19:19:48', '2026-03-08 19:19:48');

-- --------------------------------------------------------

--
-- Table structure for table `salary_settlements`
--

CREATE TABLE `salary_settlements` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `month` varchar(7) NOT NULL,
  `monthly_salary` decimal(10,2) DEFAULT 0.00,
  `extra_days` decimal(5,2) DEFAULT 0.00,
  `absent_days` decimal(5,2) DEFAULT 0.00,
  `effective_days` decimal(5,2) DEFAULT 0.00,
  `per_day_salary` decimal(10,2) DEFAULT 0.00,
  `earned_salary` decimal(10,2) DEFAULT 0.00,
  `advance_deducted` decimal(10,2) DEFAULT 0.00,
  `bonus` decimal(10,2) DEFAULT 0.00,
  `deductions` decimal(10,2) DEFAULT 0.00,
  `payable_salary` decimal(10,2) DEFAULT 0.00,
  `paid_amount` decimal(10,2) DEFAULT 0.00,
  `pending_amount` decimal(10,2) DEFAULT 0.00,
  `status` enum('draft','partial','paid') DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `settled_by` int(11) DEFAULT NULL,
  `settled_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `salary_settlements`
--

INSERT INTO `salary_settlements` (`id`, `user_id`, `month`, `monthly_salary`, `extra_days`, `absent_days`, `effective_days`, `per_day_salary`, `earned_salary`, `advance_deducted`, `bonus`, `deductions`, `payable_salary`, `paid_amount`, `pending_amount`, `status`, `notes`, `settled_by`, `settled_at`, `created_at`) VALUES
(4, 3, '2026-02', 0.00, 0.00, 0.00, 30.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'paid', NULL, 3, '2026-03-10 00:18:54', '2026-03-09 18:48:54');

-- --------------------------------------------------------

--
-- Table structure for table `staff_advances`
--

CREATE TABLE `staff_advances` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `advance_date` date NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `status` enum('pending','deducted') DEFAULT 'pending',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_day_adjustments`
--

CREATE TABLE `staff_day_adjustments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `month` varchar(7) NOT NULL,
  `extra_days` decimal(5,2) DEFAULT 0.00,
  `absent_days` decimal(5,2) DEFAULT 0.00,
  `notes` varchar(200) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `staff_day_adjustments`
--

INSERT INTO `staff_day_adjustments` (`id`, `user_id`, `month`, `extra_days`, `absent_days`, `notes`, `created_by`, `created_at`) VALUES
(40, 19, '2026-03', 1.00, 0.00, NULL, 3, '2026-03-10 15:41:49');

-- --------------------------------------------------------

--
-- Table structure for table `stock_adjustments`
--

CREATE TABLE `stock_adjustments` (
  `id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `adjustment_type` enum('add','remove') NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `adjusted_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_adjustments`
--

INSERT INTO `stock_adjustments` (`id`, `inventory_item_id`, `adjustment_type`, `quantity`, `reason`, `adjusted_by`, `created_at`) VALUES
(1, 57, 'remove', 1.000, NULL, 3, '2026-03-09 05:01:19');

-- --------------------------------------------------------

--
-- Table structure for table `units`
--

CREATE TABLE `units` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `abbreviation` varchar(20) NOT NULL,
  `type` enum('weight','volume','count','other') NOT NULL DEFAULT 'other',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `base_unit_id` int(11) DEFAULT NULL,
  `conversion_factor` decimal(20,10) DEFAULT 1.0000000000,
  `unit_type` varchar(30) DEFAULT 'weight'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `units`
--

INSERT INTO `units` (`id`, `name`, `abbreviation`, `type`, `is_active`, `created_at`, `updated_at`, `base_unit_id`, `conversion_factor`, `unit_type`) VALUES
(1, 'Kilogram', 'kg', 'weight', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(2, 'Gram', 'g', 'weight', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(3, 'Quintal', 'qtl', 'weight', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(4, 'Tonne', 'tn', 'weight', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(5, 'Litre', 'ltr', 'volume', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(6, 'Millilitre', 'ml', 'volume', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(7, 'Piece', 'pc', 'count', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(8, 'Portion', 'portion', 'count', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(9, 'Dozen', 'dz', 'count', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(10, 'Pair', 'pr', 'count', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(11, 'Packet', 'pkt', 'other', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(12, 'Box', 'box', 'other', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(13, 'Bottle', 'btl', 'other', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(14, 'Bundle', 'bndl', 'other', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight'),
(15, 'Bag', 'bag', 'other', 1, '2026-03-08 12:41:47', '2026-03-08 12:41:47', NULL, 1.0000000000, 'weight');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','manager','waiter','staff') NOT NULL DEFAULT 'staff',
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `monthly_salary` decimal(10,2) DEFAULT 0.00,
  `work_days_month` int(11) DEFAULT 30,
  `join_date` date DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `emergency_contact` varchar(20) DEFAULT NULL,
  `page_permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`page_permissions`)),
  `hours_per_day` tinyint(4) DEFAULT 8 COMMENT 'Working hours per day — used for per-minute salary in recipe costing'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `phone`, `password`, `role`, `is_active`, `last_login`, `created_at`, `updated_at`, `monthly_salary`, `work_days_month`, `join_date`, `designation`, `address`, `emergency_contact`, `page_permissions`, `hours_per_day`) VALUES
(3, 'Dharmit Soni', '7226081812', '$2a$10$cC5ZRntWSZMMzcl1v71O1.LRO67CtPzW/cFPaq/UF0al4L9tsQjLu', 'admin', 1, '2026-03-12 04:56:18', '2026-03-08 08:30:43', '2026-03-12 04:56:18', 0.00, 30, NULL, NULL, NULL, NULL, NULL, 8),
(15, 'Umesh Chef', '8905206370', '$2a$10$M2eSS/TF..8uW3zHRHWWdOpuDA6h4hQ.6pPqXpRXt2wSuNccbFQYW', 'staff', 1, NULL, '2026-03-10 15:32:50', '2026-03-10 15:32:50', 30000.00, 30, '2025-04-01', 'Head Chef', NULL, NULL, NULL, 8),
(16, 'Ram KH', '9621446384', '$2a$10$flgcTcfoCfo8TCYJ6rNmauuoCP.1icOdWuYn.9satOlMfYWuOOV7m', 'staff', 1, NULL, '2026-03-10 15:33:34', '2026-03-10 15:33:34', 15000.00, 30, '2025-04-01', 'Kitchen helper', NULL, NULL, NULL, 8),
(17, 'Bhim Saud', '7208772478', '$2a$10$xvN7w.WkcKm4pp7WL2T3Yu0X0AMQRN7fwxGMwspUvI/9Mv7d8rtZ.', 'staff', 1, NULL, '2026-03-10 15:34:19', '2026-03-10 15:34:19', 19000.00, 30, '2025-04-01', 'Chinese Chef', NULL, NULL, NULL, 8),
(18, 'Kamal', '8888888888', '$2a$10$kC4c4I/nvXPhB6wkWMJaoegXkAwZP5RqgcxIu5QXmYoFmD2WDsMZm', 'staff', 1, NULL, '2026-03-10 15:34:46', '2026-03-10 15:34:46', 12000.00, 30, '2025-04-01', 'Cleaner', NULL, NULL, NULL, 8),
(19, 'Ram Xetri', '8600404329', '$2a$10$JaTEliQehBP.is2qKgWkxun4jBY2lNLXzK9l0ylj2RhjYNA93tXQu', 'staff', 1, NULL, '2026-03-10 15:35:36', '2026-03-10 15:40:27', 27000.00, 30, '2025-03-31', 'Tandoor Chef', NULL, NULL, NULL, 10),
(20, 'Dumber', '8888888881', '$2a$10$wPVh2IvRoKKctx0uifS87efAovWxzS0i8qn9mqWONCnEk4HlrDAUa', 'staff', 1, NULL, '2026-03-10 15:36:05', '2026-03-10 15:36:05', 15000.00, 30, '2025-04-01', 'Tandoor Helper', NULL, NULL, NULL, 8),
(21, 'Naresh', '9370690258', '$2a$10$y9PIDUfzP9PJc53O2rZg4.Pl/2XtemULdA9QxIPWvcEnmUjE.NF1O', 'waiter', 1, NULL, '2026-03-10 15:36:43', '2026-03-10 15:36:43', 15000.00, 30, '2025-04-01', 'Main Weiter', NULL, NULL, NULL, 8),
(22, 'Surendra', '8097403745', '$2a$10$03vx4NTJSh.mu0h2uXn7weW7gGiAnFp87FvQIR73YFSSA0RDZpmRa', 'waiter', 1, NULL, '2026-03-10 15:38:17', '2026-03-10 15:38:17', 12000.00, 30, '2025-04-01', 'Weiter', NULL, NULL, NULL, 8),
(23, 'Ankit', '8780105205', '$2a$10$HByLGV7.U8qwR9wzVIofAuKh.ciSidbyAjxaLSpL1lNHdPvagK502', 'admin', 1, NULL, '2026-03-10 15:39:00', '2026-03-10 15:39:00', 0.00, 30, '2025-04-01', 'Admin', NULL, NULL, NULL, 8);

-- --------------------------------------------------------

--
-- Table structure for table `zomato_menu`
--

CREATE TABLE `zomato_menu` (
  `id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `listed_price` decimal(10,2) NOT NULL,
  `target_margin` decimal(5,2) DEFAULT 30.00,
  `is_available` tinyint(1) DEFAULT 1,
  `is_featured` tinyint(1) DEFAULT 0,
  `zomato_item_name` varchar(150) DEFAULT NULL,
  `zomato_description` text DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `zomato_settings`
--

CREATE TABLE `zomato_settings` (
  `id` int(11) NOT NULL,
  `commission_pct` decimal(5,2) DEFAULT 22.00,
  `active_discount` decimal(5,2) DEFAULT 0.00,
  `restaurant_name` varchar(150) DEFAULT 'My Restaurant',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `zomato_settings`
--

INSERT INTO `zomato_settings` (`id`, `commission_pct`, `active_discount`, `restaurant_name`, `updated_at`) VALUES
(1, 55.00, 10.00, 'Tasteza Restaurant', '2026-03-09 09:51:48');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `expense_categories`
--
ALTER TABLE `expense_categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `fixed_costs`
--
ALTER TABLE `fixed_costs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `fuel_profiles`
--
ALTER TABLE `fuel_profiles`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_item_name_cat` (`name`,`category_id`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `unit_id` (`unit_id`);

--
-- Indexes for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`);

--
-- Indexes for table `inventory_purchases`
--
ALTER TABLE `inventory_purchases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`),
  ADD KEY `purchased_by` (`purchased_by`);

--
-- Indexes for table `kot_items`
--
ALTER TABLE `kot_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `kot_id` (`kot_id`);

--
-- Indexes for table `kot_tickets`
--
ALTER TABLE `kot_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `login_logs`
--
ALTER TABLE `login_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `menu_courses`
--
ALTER TABLE `menu_courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `fk_menu_items_course` (`course_id`),
  ADD KEY `fk_menu_items_recipe` (`recipe_id`);

--
-- Indexes for table `menu_recipes`
--
ALTER TABLE `menu_recipes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `menu_recipe_items`
--
ALTER TABLE `menu_recipe_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `menu_recipe_id` (`menu_recipe_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `table_id` (`table_id`),
  ADD KEY `coupon_id` (`coupon_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `billed_by` (`billed_by`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `menu_item_id` (`menu_item_id`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `po_number` (`po_number`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `received_by` (`received_by`);

--
-- Indexes for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`),
  ADD KEY `unit_id` (`unit_id`);

--
-- Indexes for table `recipes`
--
ALTER TABLE `recipes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `yield_unit_id` (`yield_unit_id`),
  ADD KEY `fk_recipes_course` (`course_id`);

--
-- Indexes for table `recipe_items`
--
ALTER TABLE `recipe_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recipe_id` (`recipe_id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`);

--
-- Indexes for table `recipe_salary_staff`
--
ALTER TABLE `recipe_salary_staff`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recipe_id` (`recipe_id`),
  ADD KEY `salary_id` (`salary_id`);

--
-- Indexes for table `restaurant_settings`
--
ALTER TABLE `restaurant_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role` (`role`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indexes for table `salary_profiles`
--
ALTER TABLE `salary_profiles`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `salary_settlements`
--
ALTER TABLE `salary_settlements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_month` (`user_id`,`month`),
  ADD KEY `settled_by` (`settled_by`);

--
-- Indexes for table `staff_advances`
--
ALTER TABLE `staff_advances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `staff_day_adjustments`
--
ALTER TABLE `staff_day_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`),
  ADD KEY `adjusted_by` (`adjusted_by`);

--
-- Indexes for table `units`
--
ALTER TABLE `units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `abbreviation` (`abbreviation`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`);

--
-- Indexes for table `zomato_menu`
--
ALTER TABLE `zomato_menu`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_menu_item` (`menu_item_id`);

--
-- Indexes for table `zomato_settings`
--
ALTER TABLE `zomato_settings`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `coupons`
--
ALTER TABLE `coupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `expense_categories`
--
ALTER TABLE `expense_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `fixed_costs`
--
ALTER TABLE `fixed_costs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fuel_profiles`
--
ALTER TABLE `fuel_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=140;

--
-- AUTO_INCREMENT for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `inventory_purchases`
--
ALTER TABLE `inventory_purchases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `kot_items`
--
ALTER TABLE `kot_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `kot_tickets`
--
ALTER TABLE `kot_tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `login_logs`
--
ALTER TABLE `login_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=129;

--
-- AUTO_INCREMENT for table `menu_courses`
--
ALTER TABLE `menu_courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `menu_recipes`
--
ALTER TABLE `menu_recipes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `menu_recipe_items`
--
ALTER TABLE `menu_recipe_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `recipes`
--
ALTER TABLE `recipes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `recipe_items`
--
ALTER TABLE `recipe_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=626;

--
-- AUTO_INCREMENT for table `recipe_salary_staff`
--
ALTER TABLE `recipe_salary_staff`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `role_permissions`
--
ALTER TABLE `role_permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `salary_profiles`
--
ALTER TABLE `salary_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `salary_settlements`
--
ALTER TABLE `salary_settlements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `staff_advances`
--
ALTER TABLE `staff_advances`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `staff_day_adjustments`
--
ALTER TABLE `staff_day_adjustments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `units`
--
ALTER TABLE `units`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `zomato_menu`
--
ALTER TABLE `zomato_menu`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `zomato_settings`
--
ALTER TABLE `zomato_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `fixed_costs`
--
ALTER TABLE `fixed_costs`
  ADD CONSTRAINT `fixed_costs_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `inventory_items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `inventory_items_ibfk_2` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`);

--
-- Constraints for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD CONSTRAINT `inventory_movements_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_purchases`
--
ALTER TABLE `inventory_purchases`
  ADD CONSTRAINT `inventory_purchases_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_purchases_ibfk_2` FOREIGN KEY (`purchased_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `kot_items`
--
ALTER TABLE `kot_items`
  ADD CONSTRAINT `kot_items_ibfk_1` FOREIGN KEY (`kot_id`) REFERENCES `kot_tickets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `kot_tickets`
--
ALTER TABLE `kot_tickets`
  ADD CONSTRAINT `kot_tickets_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kot_tickets_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `login_logs`
--
ALTER TABLE `login_logs`
  ADD CONSTRAINT `login_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD CONSTRAINT `fk_menu_items_course` FOREIGN KEY (`course_id`) REFERENCES `menu_courses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_menu_items_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `menu_recipe_items`
--
ALTER TABLE `menu_recipe_items`
  ADD CONSTRAINT `menu_recipe_items_ibfk_1` FOREIGN KEY (`menu_recipe_id`) REFERENCES `menu_recipes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_4` FOREIGN KEY (`billed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`);

--
-- Constraints for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD CONSTRAINT `purchase_order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_order_items_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_order_items_ibfk_3` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `recipes`
--
ALTER TABLE `recipes`
  ADD CONSTRAINT `fk_recipes_course` FOREIGN KEY (`course_id`) REFERENCES `menu_courses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `recipes_ibfk_1` FOREIGN KEY (`yield_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `recipe_items`
--
ALTER TABLE `recipe_items`
  ADD CONSTRAINT `recipe_items_ibfk_1` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `recipe_items_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`);

--
-- Constraints for table `recipe_salary_staff`
--
ALTER TABLE `recipe_salary_staff`
  ADD CONSTRAINT `recipe_salary_staff_ibfk_1` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `recipe_salary_staff_ibfk_2` FOREIGN KEY (`salary_id`) REFERENCES `salary_profiles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `salary_settlements`
--
ALTER TABLE `salary_settlements`
  ADD CONSTRAINT `salary_settlements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `salary_settlements_ibfk_2` FOREIGN KEY (`settled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `staff_advances`
--
ALTER TABLE `staff_advances`
  ADD CONSTRAINT `staff_advances_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staff_advances_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `staff_day_adjustments`
--
ALTER TABLE `staff_day_adjustments`
  ADD CONSTRAINT `staff_day_adjustments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staff_day_adjustments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD CONSTRAINT `stock_adjustments_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_adjustments_ibfk_2` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `zomato_menu`
--
ALTER TABLE `zomato_menu`
  ADD CONSTRAINT `zomato_menu_ibfk_1` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
