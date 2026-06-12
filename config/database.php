<?php
declare(strict_types=1);

return [
    'host' => getenv('SAT_DB_HOST') ?: 'localhost',
    'port' => (int) (getenv('SAT_DB_PORT') ?: 3306),
    'database' => getenv('SAT_DB_NAME') ?: 'sat',
    'username' => getenv('SAT_DB_USER') ?: 'root',
    'password' => getenv('SAT_DB_PASSWORD') ?: '',
    'charset' => 'utf8mb4',
    'storage_root' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'storage-data',
    'base_url' => getenv('SAT_BASE_URL') ?: '',
    'mail_from' => getenv('SAT_MAIL_FROM') ?: 'sat@example.com',
];
