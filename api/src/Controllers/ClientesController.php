<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class ClientesController
{
    public function index(Request $request, array $params): void
    {
        Auth::requireLogin();
        $pdo = Db::pdo();
        $st = $pdo->query('SELECT id, nombre, direccion, telefono, email, lat, lng, created_at FROM clientes ORDER BY created_at DESC');
        $items = $st->fetchAll() ?: [];
        Http::json($items);
    }

    public function create(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $body = is_array($request->body) ? $request->body : [];
        $nombre = trim((string)($body['nombre'] ?? ''));
        if ($nombre === '') {
            Http::json(['error' => 'El nombre del cliente es obligatorio.'], 400);
        }

        $id = Uuid::v4();
        $pdo = Db::pdo();
        $st = $pdo->prepare('INSERT INTO clientes (id, nombre, direccion, telefono, email, lat, lng) VALUES (:id, :n, :d, :t, :e, :lat, :lng)');
        $st->execute([
            ':id' => $id,
            ':n' => $nombre,
            ':d' => $body['direccion'] ?? null,
            ':t' => $body['telefono'] ?? null,
            ':e' => $body['email'] ?? null,
            ':lat' => $body['lat'] ?? null,
            ':lng' => $body['lng'] ?? null,
        ]);

        $row = $pdo->prepare('SELECT id, nombre, direccion, telefono, email, lat, lng, created_at FROM clientes WHERE id = :id');
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
        $nombre = isset($body['nombre']) ? trim((string)$body['nombre']) : null;
        if ($nombre !== null && $nombre === '') {
            Http::json(['error' => 'El nombre del cliente es obligatorio.'], 400);
        }

        $pdo = Db::pdo();
        $set = [];
        $bind = [':id' => $id];
        foreach (['nombre', 'direccion', 'telefono', 'email', 'lat', 'lng'] as $campo) {
            if (!array_key_exists($campo, $body)) {
                continue;
            }
            if ($campo === 'nombre') {
                $set[] = 'nombre = :nombre';
                $bind[':nombre'] = $nombre;
                continue;
            }
            $set[] = $campo . ' = :' . $campo;
            $bind[':' . $campo] = $body[$campo] ?? null;
        }
        if (count($set) === 0) {
            Http::json(['error' => 'No hay cambios para aplicar.'], 400);
        }
        $sql = 'UPDATE clientes SET ' . implode(', ', $set) . ' WHERE id = :id';
        $st = $pdo->prepare($sql);
        $st->execute($bind);

        $row = $pdo->prepare('SELECT id, nombre, direccion, telefono, email, lat, lng, created_at FROM clientes WHERE id = :id');
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
        $st = $pdo->prepare('DELETE FROM clientes WHERE id = :id');
        $st->execute([':id' => $id]);
        Http::json(['ok' => true]);
    }
}
