<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Sat\\Api\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $rel = substr($class, strlen($prefix));
    $path = __DIR__ . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, $rel) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

$cfg = require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'database.php';
\Sat\Api\App::setConfig($cfg);

$timezone = trim((string)($cfg['timezone'] ?? ''));
if ($timezone === '') {
    $timezone = 'UTC';
}
date_default_timezone_set($timezone);

$cookieSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $cookieSecure,
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

\Sat\Api\Http::applySecurityHeaders();
\Sat\Api\Http::applyCors();
