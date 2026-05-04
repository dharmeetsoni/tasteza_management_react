-- migration: settings_integrations_config
-- date: 2026-03-29
-- purpose: Add Firebase, PhonePe, Google Maps config and delivery settings to restaurant_settings
ALTER TABLE restaurant_settings
ADD COLUMN firebase_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN firebase_auth_domain VARCHAR(255) DEFAULT NULL,
ADD COLUMN firebase_project_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN firebase_app_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN phonepay_merchant_id VARCHAR(100) DEFAULT NULL,
ADD COLUMN phonepay_salt_key VARCHAR(100) DEFAULT NULL,
ADD COLUMN phonepay_salt_index VARCHAR(10) DEFAULT '1',
ADD COLUMN phonepay_env VARCHAR(20) DEFAULT 'sandbox',
ADD COLUMN google_maps_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN delivery_charge DECIMAL(10, 2) DEFAULT 30.00,
ADD COLUMN delivery_free_above DECIMAL(10, 2) DEFAULT 199.00,
ADD COLUMN auto_accept_seconds INT DEFAULT 0,
ADD COLUMN online_ordering_enabled TINYINT (1) DEFAULT 1;