-- Bill / Restaurant Settings
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id              INT PRIMARY KEY DEFAULT 1,
  restaurant_name VARCHAR(100) DEFAULT 'Tasteza Restaurant',
  tagline         VARCHAR(200) DEFAULT 'Thank you for dining with us!',
  address         TEXT,
  phone           VARCHAR(20),
  email           VARCHAR(100),
  website         VARCHAR(100),
  gst_number      VARCHAR(20),
  fssai_number    VARCHAR(20),
  currency_symbol VARCHAR(5)  DEFAULT '₹',
  logo_base64     LONGTEXT,
  logo_width      INT DEFAULT 120,
  bill_footer     TEXT DEFAULT 'Have a great day! 😊',
  show_logo       TINYINT DEFAULT 1,
  show_gst_break  TINYINT DEFAULT 1,
  show_qr         TINYINT DEFAULT 1,
  show_thank_you  TINYINT DEFAULT 1,
  bill_copies     INT DEFAULT 1,
  primary_color   VARCHAR(10) DEFAULT '#e84a5f',
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO restaurant_settings (id) VALUES (1);
