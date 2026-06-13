<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class EquiposController
{
    public function index(Request $request, array $params): void
    {
        Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $pdo = Db::pdo();
        $sql = 'SELECT e.id, e.cliente_id, e.nombre, e.marca, e.modelo, e.numero_serie, e.ultima_revision, c.nombre AS cliente_nombre
                FROM equipos e
                JOIN clientes c ON c.id = e.cliente_id
                ORDER BY e.nombre ASC';
        $st = $pdo->query($sql);
        $items = [];
        foreach (($st->fetchAll() ?: []) as $row) {
            $row['clientes'] = ['nombre' => $row['cliente_nombre']];
            unset($row['cliente_nombre']);
            $items[] = $row;
        }
        Http::json($items);
    }

    public function create(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $body = is_array($request->body) ? $request->body : [];
        $clienteId = trim((string)($body['cliente_id'] ?? ''));
        $nombre = trim((string)($body['nombre'] ?? ''));
        if ($clienteId === '') {
            Http::json(['error' => 'cliente_id es obligatorio.'], 400);
        }
        if ($nombre === '') {
            Http::json(['error' => 'El nombre del equipo es obligatorio.'], 400);
        }

        $pdo = Db::pdo();
        $chk = $pdo->prepare('SELECT id FROM clientes WHERE id = :id');
        $chk->execute([':id' => $clienteId]);
        if (!$chk->fetch()) {
            Http::json(['error' => 'El cliente seleccionado no existe.'], 400);
        }

        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO equipos (id, cliente_id, nombre, marca, modelo, numero_serie, ultima_revision) VALUES (:id, :c, :n, :m, :mo, :ns, :ur)');
        $st->execute([
            ':id' => $id,
            ':c' => $clienteId,
            ':n' => $nombre,
            ':m' => $body['marca'] ?? null,
            ':mo' => $body['modelo'] ?? null,
            ':ns' => $body['numero_serie'] ?? null,
            ':ur' => $body['ultima_revision'] ?? null,
        ]);

        $row = $pdo->prepare('SELECT id, cliente_id, nombre, marca, modelo, numero_serie, ultima_revision FROM equipos WHERE id = :id');
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
            Http::json(['error' => 'El nombre del equipo es obligatorio.'], 400);
        }

        $pdo = Db::pdo();
        $set = [];
        $bind = [':id' => $id];
        foreach (['cliente_id', 'nombre', 'marca', 'modelo', 'numero_serie', 'ultima_revision'] as $campo) {
            if (!array_key_exists($campo, $body)) {
                continue;
            }
            $set[] = $campo . ' = :' . $campo;
            $bind[':' . $campo] = $body[$campo] ?? null;
        }
        if (count($set) === 0) {
            Http::json(['error' => 'No hay cambios para aplicar.'], 400);
        }

        if (array_key_exists('cliente_id', $body)) {
            $clienteId = trim((string)($body['cliente_id'] ?? ''));
            if ($clienteId === '') {
                Http::json(['error' => 'cliente_id es obligatorio.'], 400);
            }
            $chk = $pdo->prepare('SELECT id FROM clientes WHERE id = :id');
            $chk->execute([':id' => $clienteId]);
            if (!$chk->fetch()) {
                Http::json(['error' => 'El cliente seleccionado no existe.'], 400);
            }
        }

        $sql = 'UPDATE equipos SET ' . implode(', ', $set) . ' WHERE id = :id';
        $st = $pdo->prepare($sql);
        $st->execute($bind);

        $row = $pdo->prepare('SELECT id, cliente_id, nombre, marca, modelo, numero_serie, ultima_revision FROM equipos WHERE id = :id');
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
        $st = $pdo->prepare('DELETE FROM equipos WHERE id = :id');
        $st->execute([':id' => $id]);
        Http::json(['ok' => true]);
    }
}

