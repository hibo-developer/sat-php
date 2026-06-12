<?php
declare(strict_types=1);

namespace Sat\Api;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        public readonly mixed $body,
        public readonly array $files,
    ) {}

    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = preg_replace('#^/api#', '', $path) ?: '/';
        if ($path === '') {
            $path = '/';
        }

        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr($k, 5)));
                $headers[$name] = $v;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }

        $body = null;
        $contentType = strtolower((string)($headers['content-type'] ?? ''));
        if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
            if (str_contains($contentType, 'application/json')) {
                $raw = file_get_contents('php://input');
                $decoded = $raw !== '' ? json_decode($raw, true) : null;
                $body = is_array($decoded) ? $decoded : null;
            } elseif (str_contains($contentType, 'application/x-www-form-urlencoded')) {
                $body = $_POST;
            } elseif (str_contains($contentType, 'multipart/form-data')) {
                $body = $_POST;
            } else {
                $raw = file_get_contents('php://input');
                $body = $raw !== '' ? $raw : null;
            }
        }

        return new self($method, $path, $_GET, $headers, $body, $_FILES);
    }

    public function header(string $name, string $default = ''): string
    {
        $key = strtolower($name);
        return isset($this->headers[$key]) ? (string)$this->headers[$key] : $default;
    }
}
