<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class TecnicosController
{
    public function index(Request $request, array $params): void
    {
        Auth::requireLogin();
        $pdo = Db::pdo();
        $st = $pdo->query('SELECT id, nombre, especialidad, activo FROM tecnicos ORDER BY nombre ASC');
        Http::json($st->fetchAll() ?: []);
    }

    public function create(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $body = is_array($request->body) ? $request->body : [];
        $nombre = trim((string)($body['nombre'] ?? ''));
        if ($nombre === '') {
            Http::json(['error' => 'El nombre del técnico es obligatorio.'], 400);
        }
        $id = Uuid::v4();
        $pdo = Db::pdo();
        $st = $pdo->prepare('INSERT INTO tecnicos (id, nombre, especialidad, activo, user_id) VALUES (:id, :n, :e, :a, :u)');
        $st->execute([
            ':id' => $id,
            ':n' => $nombre,
            ':e' => $body['especialidad'] ?? null,
            ':a' => isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
            ':u' => $body['user_id'] ?? null,
        ]);
        $row = $pdo->prepare('SELECT id, nombre, especialidad, activo FROM tecnicos WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
    }

    public function update(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];
        if (array_key_exists('nombre', $body) && trim((string)$body['nombre']) === '') {
            Http::json(['error' => 'El nombre del técnico es obligatorio.'], 400);
        }

        $pdo = Db::pdo();
        $set = [];
        $bind = [':id' => $id];
        foreach (['nombre', 'especialidad', 'activo'] as $campo) {
            if (!array_key_exists($campo, $body)) {
                continue;
            }
            $set[] = $campo . ' = :' . $campo;
            if ($campo === 'activo') {
                $bind[':' . $campo] = (int)(bool)$body[$campo];
            } else {
                $bind[':' . $campo] = $body[$campo] ?? null;
            }
        }
        if (count($set) === 0) {
            Http::json(['error' => 'No hay cambios para aplicar.'], 400);
        }
        $sql = 'UPDATE tecnicos SET ' . implode(', ', $set) . ' WHERE id = :id';
        $st = $pdo->prepare($sql);
        $st->execute($bind);

        $row = $pdo->prepare('SELECT id, nombre, especialidad, activo FROM tecnicos WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
    }

    public function delete(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $pdo = Db::pdo();
        $st = $pdo->prepare('DELETE FROM tecnicos WHERE id = :id');
        $st->execute([':id' => $id]);
        Http::json(['ok' => true]);
    }
}

