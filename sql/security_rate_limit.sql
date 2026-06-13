CREATE TABLE IF NOT EXISTS auth_login_rate_limits (
  scope ENUM('ip', 'email') NOT NULL,
  identifier VARCHAR(190) NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  last_attempt_at DATETIME NOT NULL,
  blocked_until DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scope, identifier),
  KEY idx_auth_login_rate_limits_blocked_until (blocked_until),
  KEY idx_auth_login_rate_limits_last_attempt_at (last_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
