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
    'setup_token' => getenv('SAT_SETUP_TOKEN') ?: '',
];

$localPath = __DIR__ . DIRECTORY_SEPARATOR . 'database.local.php';
if (is_file($localPath)) {
    $local = require $localPath;
    if (is_array($local)) {
        $cfg = array_replace($cfg, $local);
    }
}

return $cfg;
