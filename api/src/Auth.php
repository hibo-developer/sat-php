<?php
declare(strict_types=1);

namespace Sat\Api;

final class Auth
{
    public static function requireCsrf(Request $request): void
    {
        $method = strtoupper($request->method);
        if (in_array($method, ['GET', 'OPTIONS'], true)) {
            return;
        }

        $path = $request->path;
        if ($path === '/auth/login') {
            return;
        }

        $token = (string)$request->header('x-csrf-token');
        $expected = (string)($_SESSION['csrf_token'] ?? '');
        if (!$token || !$expected || !hash_equals($expected, $token)) {
            Http::json(['error' => 'CSRF token inválido.'], 403);
        }
    }

    public static function ensureCsrfToken(): string
    {
        $token = (string)($_SESSION['csrf_token'] ?? '');
        if ($token !== '') {
            return $token;
        }
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
        return $token;
    }

    public static function login(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (string)$user['id'],
            'email' => (string)$user['email'],
        ];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    public static function user(): ?array
    {
        $u = $_SESSION['user'] ?? null;
        if (!is_array($u) || empty($u['id'])) {
            return null;
        }
        return $u;
    }

    public static function requireLogin(): array
    {
        $u = self::user();
        if (!$u) {
            Http::json(['error' => 'Sesión no válida o expirada.'], 401);
        }
        return $u;
    }

    public static function roleForUserId(string $userId): ?string
    {
        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT rol FROM usuarios_sat WHERE user_id = :id');
        $st->execute([':id' => $userId]);
        $row = $st->fetch();
        return $row ? (string)$row['rol'] : null;
    }

    public static function requireRole(array $roles): array
    {
        $u = self::requireLogin();
        $rol = self::roleForUserId((string)$u['id']) ?: '';
        if (!in_array($rol, $roles, true)) {
            Http::json(['error' => 'Acceso denegado.'], 403);
        }
        $u['rol'] = $rol;
        return $u;
    }
}

