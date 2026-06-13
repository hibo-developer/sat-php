<?php
declare(strict_types=1);

namespace Sat\Api;

final class Http
{
    public static function applySecurityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    }

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
        $allowedList = self::allowedOrigins();
        $originAllowed = $origin !== '' && in_array(self::normalizeOrigin($origin), $allowedList, true);

        if ($originAllowed) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Max-Age: 600');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            if ($origin !== '' && !$originAllowed) {
                self::json(['error' => 'Origen no permitido.'], 403);
            }
            http_response_code(204);
            exit;
        }
    }

    private static function allowedOrigins(): array
    {
        $raw = App::config('allowed_origins', '');
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $items = array_map(
            static fn(string $origin): string => self::normalizeOrigin($origin),
            array_filter(array_map('trim', explode(',', $raw)))
        );

        return array_values(array_unique(array_filter($items)));
    }

    private static function normalizeOrigin(string $origin): string
    {
        return rtrim(trim($origin), '/');
    }
}
