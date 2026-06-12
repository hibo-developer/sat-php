<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;

final class AuthController
{
    public function login(Request $request, array $params): void
    {
        $body = is_array($request->body) ? $request->body : [];
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');

        if ($email === '' || $password === '') {
            Http::json(['error' => 'Email y contraseña son obligatorios.'], 400);
        }

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, email, password_hash, activo FROM usuarios WHERE email = :email LIMIT 1');
        $st->execute([':email' => $email]);
        $user = $st->fetch();

        if (!$user || (int)$user['activo'] !== 1 || !password_verify($password, (string)$user['password_hash'])) {
            usleep(250000);
            Http::json(['error' => 'Credenciales inválidas.'], 401);
        }

        Auth::login($user);
        $me = $this->buildMePayload((string)$user['id'], (string)$user['email']);
        Http::json($me);
    }

    public function me(Request $request, array $params): void
    {
        $u = Auth::user();
        if (!$u) {
            Http::json(['session' => null]);
        }
        Http::json($this->buildMePayload((string)$u['id'], (string)$u['email']));
    }

    public function logout(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::logout();
        Http::json(['ok' => true]);
    }

    public function changePassword(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireLogin();
        $body = is_array($request->body) ? $request->body : [];
        $password = (string)($body['password'] ?? '');

        $this->validarPasswordBasica($password);

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $pdo = Db::pdo();
        $st = $pdo->prepare('UPDATE usuarios SET password_hash = :h WHERE id = :id');
        $st->execute([':h' => $hash, ':id' => (string)$u['id']]);

        Http::json(['ok' => true]);
    }

    private function validarPasswordBasica(string $password): void
    {
        $p = (string)$password;
        if (strlen($p) < 10) {
            Http::json(['error' => 'La contraseña debe tener al menos 10 caracteres.'], 400);
        }
        if (!preg_match('/[a-z]/', $p) || !preg_match('/[A-Z]/', $p) || !preg_match('/\d/', $p)) {
            Http::json(['error' => 'La contraseña debe incluir mayúsculas, minúsculas y números.'], 400);
        }
    }

    private function buildMePayload(string $userId, string $email): array
    {
        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT rol, nombre_visible FROM usuarios_sat WHERE user_id = :id');
        $st->execute([':id' => $userId]);
        $perfil = $st->fetch();

        return [
            'session' => [
                'user' => [
                    'id' => $userId,
                    'email' => $email,
                ],
            ],
            'perfil' => $perfil ? [
                'rol' => (string)$perfil['rol'],
                'nombre_visible' => (string)($perfil['nombre_visible'] ?? ''),
            ] : null,
            'csrfToken' => Auth::ensureCsrfToken(),
        ];
    }
}

