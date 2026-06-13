<?php
declare(strict_types=1);

$cfg = [
    'host' => getenv('SAT_DB_HOST') ?: 'localhost',
    'port' => (int) (getenv('SAT_DB_PORT') ?: 3306),
    'database' => getenv('SAT_DB_NAME') ?: 'sat',
    'username' => getenv('SAT_DB_USER') ?: 'root',
    'password' => getenv('SAT_DB_PASSWORD') ?: '',
    'charset' => 'utf8mb4',
    'storage_root' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'storage-data',
    'base_url' => getenv('SAT_BASE_URL') ?: '',
    'timezone' => getenv('SAT_TIMEZONE') ?: 'Europe/Madrid',
    'mail_from' => getenv('SAT_MAIL_FROM') ?: 'sat@example.com',
    'allowed_origins' => getenv('SAT_ALLOWED_ORIGINS') ?: '',
    'login_limit_ip_attempts' => (int)(getenv('SAT_LOGIN_LIMIT_IP_ATTEMPTS') ?: 10),
    'login_limit_email_attempts' => (int)(getenv('SAT_LOGIN_LIMIT_EMAIL_ATTEMPTS') ?: 5),
    'login_limit_window_seconds' => (int)(getenv('SAT_LOGIN_LIMIT_WINDOW_SECONDS') ?: 900),
    'login_limit_block_seconds' => (int)(getenv('SAT_LOGIN_LIMIT_BLOCK_SECONDS') ?: 900),
    'setup_token' => getenv('SAT_SETUP_TOKEN') ?: '',
    'setup_enabled' => filter_var(getenv('SAT_SETUP_ENABLED') ?: false, FILTER_VALIDATE_BOOL),
];

$localPath = __DIR__ . DIRECTORY_SEPARATOR . 'database.local.php';
if (is_file($localPath)) {
    $local = require $localPath;
    if (is_array($local)) {
        $cfg = array_replace($cfg, $local);
    }
}

return $cfg;
