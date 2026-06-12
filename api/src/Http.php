<?php
declare(strict_types=1);

namespace Sat\Api;

final class Http
{
    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function text(string $payload, int $status = 200, string $contentType = 'text/plain; charset=UTF-8'): void
    {
        http_response_code($status);
        header('Content-Type: ' . $contentType);
        echo $payload;
        exit;
    }

    public static function applyCors(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = getenv('SAT_ALLOWED_ORIGINS') ?: '';
        $allowedList = array_values(array_filter(array_map('trim', explode(',', $allowed))));

        if ($origin && (empty($allowedList) || in_array($origin, $allowedList, true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
