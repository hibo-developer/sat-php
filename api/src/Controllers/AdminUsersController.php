<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class AdminUsersController
{
    private const ROLES = ['admin', 'oficina', 'tecnico'];

    public function handle(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin']);
        $body = is_array($request->body) ? $request->body : [];
        $action = strtolower(trim((string)($body['action'] ?? '')));
        $payload = isset($body['payload']) && is_array($body['payload']) ? $body['payload'] : [];

        if (!in_array($action, ['list', 'create', 'update', 'delete'], true)) {
            Http::json(['error' => 'Acción no soportada.'], 400);
        }

        return match ($action) {
            'list' => $this->list(),
            'create' => $this->create($payload),
            'update' => $this->update($u, $payload),
            'delete' => $this->delete($u, $payload),
        };
    }

    private function list(): void
    {
        $pdo = Db::pdo();
        $sql = 'SELECT u.id AS user_id, u.email, s.rol, s.nombre_visible,
                       t.id AS tecnico_id, t.nombre AS tecnico_nombre, t.especialidad AS tecnico_especialidad, t.activo AS tecnico_activo
                FROM usuarios u
                LEFT JOIN usuarios_sat s ON s.user_id = u.id
                LEFT JOIN tecnicos t ON t.user_id = u.id
                ORDER BY u.created_at DESC';
        $st = $pdo->query($sql);
        $users = $st->fetchAll() ?: [];
        Http::json(['users' => $users]);
    }

    private function create(array $payload): void
    {
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $password = (string)($payload['password'] ?? '');
        $rol = strtolower(trim((string)($payload['rol'] ?? '')));
        $nombreVisible = isset($payload['nombre_visible']) ? trim((string)$payload['nombre_visible']) : null;

        if ($email === '') {
            Http::json(['error' => 'El email es obligatorio.'], 400);
        }
        if ($password === '') {
            Http::json(['error' => 'La contraseña inicial es obligatoria.'], 400);
        }
        if (!in_array($rol, self::ROLES, true)) {
            Http::json(['error' => 'El rol seleccionado no es válido.'], 400);
        }
        $this->validarPasswordBasica($password);

        $pdo = Db::pdo();
        $userId = Uuid::v4();
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('INSERT INTO usuarios (id, email, password_hash, activo) VALUES (:id, :e, :h, 1)');
            $st->execute([':id' => $userId, ':e' => $email, ':h' => $hash]);

            $st = $pdo->prepare('INSERT INTO usuarios_sat (user_id, rol, nombre_visible) VALUES (:id, :r, :n)');
            $st->execute([':id' => $userId, ':r' => $rol, ':n' => ($nombreVisible === '' ? null : $nombreVisible)]);

            if ($rol === 'tecnico') {
                $tecId = Uuid::v4();
                $tecNombre = trim((string)($payload['tecnico_nombre'] ?? '')) ?: ($nombreVisible ?: $email);
                $tecEsp = trim((string)($payload['tecnico_especialidad'] ?? '')) ?: null;
                $st = $pdo->prepare('INSERT INTO tecnicos (id, user_id, nombre, especialidad, activo) VALUES (:id, :u, :n, :e, 1)');
                $st->execute([':id' => $tecId, ':u' => $userId, ':n' => $tecNombre, ':e' => $tecEsp]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            Http::json(['error' => 'No se pudo crear el usuario.'], 500);
        }

        $user = $this->getUserRow($pdo, $userId);
        Http::json(['user' => $user]);
    }

    private function update(array $actor, array $payload): void
    {
        $userId = trim((string)($payload['user_id'] ?? ''));
        if ($userId === '') {
            Http::json(['error' => 'user_id es obligatorio.'], 400);
        }

        $rol = strtolower(trim((string)($payload['rol'] ?? '')));
        if (!in_array($rol, self::ROLES, true)) {
            Http::json(['error' => 'El rol seleccionado no es válido.'], 400);
        }

        $email = array_key_exists('email', $payload) ? strtolower(trim((string)($payload['email'] ?? ''))) : null;
        $password = array_key_exists('password', $payload) ? (string)($payload['password'] ?? '') : null;
        $nombreVisible = array_key_exists('nombre_visible', $payload) ? trim((string)($payload['nombre_visible'] ?? '')) : null;

        if ($email !== null && $email === '') {
            $email = null;
        }
        if ($password !== null && $password !== '') {
            $this->validarPasswordBasica($password);
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            if ($email !== null) {
                $st = $pdo->prepare('UPDATE usuarios SET email = :e WHERE id = :id');
                $st->execute([':e' => $email, ':id' => $userId]);
            }
            if ($password !== null && $password !== '') {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $st = $pdo->prepare('UPDATE usuarios SET password_hash = :h WHERE id = :id');
                $st->execute([':h' => $hash, ':id' => $userId]);
            }

            $st = $pdo->prepare('UPDATE usuarios_sat SET rol = :r, nombre_visible = :n WHERE user_id = :id');
            $st->execute([
                ':r' => $rol,
                ':n' => ($nombreVisible !== null && $nombreVisible !== '' ? $nombreVisible : null),
                ':id' => $userId,
            ]);

            $st = $pdo->prepare('SELECT id, activo FROM tecnicos WHERE user_id = :u LIMIT 1');
            $st->execute([':u' => $userId]);
            $tec = $st->fetch();

            if ($rol === 'tecnico') {
                $tecNombre = trim((string)($payload['tecnico_nombre'] ?? '')) ?: ($nombreVisible ?: ($email ?: 'Técnico'));
                $tecEsp = trim((string)($payload['tecnico_especialidad'] ?? '')) ?: null;

                if (!$tec) {
                    $tecId = Uuid::v4();
                    $st = $pdo->prepare('INSERT INTO tecnicos (id, user_id, nombre, especialidad, activo) VALUES (:id, :u, :n, :e, 1)');
                    $st->execute([':id' => $tecId, ':u' => $userId, ':n' => $tecNombre, ':e' => $tecEsp]);
                } else {
                    $st = $pdo->prepare('UPDATE tecnicos SET nombre = :n, especialidad = :e, activo = 1 WHERE user_id = :u');
                    $st->execute([':n' => $tecNombre, ':e' => $tecEsp, ':u' => $userId]);
                }
            } else {
                if ($tec) {
                    $st = $pdo->prepare('UPDATE tecnicos SET activo = 0, user_id = NULL WHERE user_id = :u');
                    $st->execute([':u' => $userId]);
                }
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            Http::json(['error' => 'No se pudo actualizar el usuario.'], 500);
        }

        $user = $this->getUserRow($pdo, $userId);
        Http::json(['user' => $user]);
    }

    private function delete(array $actor, array $payload): void
    {
        $userId = trim((string)($payload['user_id'] ?? ''));
        if ($userId === '') {
            Http::json(['error' => 'user_id es obligatorio.'], 400);
        }
        if ((string)$actor['id'] === $userId) {
            Http::json(['error' => 'No puedes eliminar tu propio usuario.'], 400);
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('UPDATE tecnicos SET activo = 0, user_id = NULL WHERE user_id = :u');
            $st->execute([':u' => $userId]);

            $st = $pdo->prepare('DELETE FROM usuarios_sat WHERE user_id = :u');
            $st->execute([':u' => $userId]);

            $st = $pdo->prepare('DELETE FROM usuarios WHERE id = :u');
            $st->execute([':u' => $userId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            Http::json(['error' => 'No se pudo eliminar el usuario.'], 500);
        }

        Http::json(['ok' => true]);
    }

    private function getUserRow(\PDO $pdo, string $userId): ?array
    {
        $st = $pdo->prepare('SELECT u.id AS user_id, u.email, s.rol, s.nombre_visible,
                                    t.id AS tecnico_id, t.nombre AS tecnico_nombre, t.especialidad AS tecnico_especialidad, t.activo AS tecnico_activo
                             FROM usuarios u
                             LEFT JOIN usuarios_sat s ON s.user_id = u.id
                             LEFT JOIN tecnicos t ON t.user_id = u.id
                             WHERE u.id = :id
                             LIMIT 1');
        $st->execute([':id' => $userId]);
        $row = $st->fetch();
        return $row ?: null;
    }

    private function validarPasswordBasica(string $password): void
    {
        if (strlen($password) < 10) {
            Http::json(['error' => 'La contraseña debe tener al menos 10 caracteres.'], 400);
        }
        if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password)) {
            Http::json(['error' => 'La contraseña debe incluir mayúsculas, minúsculas y números.'], 400);
        }
    }
}

