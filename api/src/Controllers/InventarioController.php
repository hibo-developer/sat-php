<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class InventarioController
{
    public function listarMateriales(Request $request, array $params): void
    {
        Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $soloActivos = isset($request->query['soloActivos']) && (string)$request->query['soloActivos'] !== '0';
        $pdo = Db::pdo();
        $sql = 'SELECT id, nombre, descripcion, unidad, stock_actual, precio_ref, activo, creado_en FROM inventario_materiales';
        if ($soloActivos) {
            $sql .= ' WHERE activo = 1';
        }
        $sql .= ' ORDER BY nombre ASC';
        $st = $pdo->query($sql);
        Http::json($st->fetchAll() ?: []);
    }

    public function listarMovimientos(Request $request, array $params): void
    {
        Auth::requireRole(['admin', 'oficina']);
        $materialId = trim((string)($request->query['materialId'] ?? ''));
        $limite = (int)($request->query['limite'] ?? 50);
        $limite = max(1, min(200, $limite));
        $pdo = Db::pdo();

        $sql = 'SELECT m.id, m.material_id, m.tipo_movimiento, m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo, m.creado_en,
                       i.nombre AS material_nombre, i.unidad AS material_unidad
                FROM inventario_movimientos m
                JOIN inventario_materiales i ON i.id = m.material_id';
        $bind = [];
        if ($materialId !== '') {
            $sql .= ' WHERE m.material_id = :mid';
            $bind[':mid'] = $materialId;
        }
        $sql .= ' ORDER BY m.creado_en DESC LIMIT ' . $limite;
        $st = $pdo->prepare($sql);
        $st->execute($bind);

        $items = [];
        foreach (($st->fetchAll() ?: []) as $row) {
            $row['inventario_materiales'] = [
                'nombre' => $row['material_nombre'],
                'unidad' => $row['material_unidad'],
            ];
            unset($row['material_nombre'], $row['material_unidad']);
            $items[] = $row;
        }

        Http::json(['soportado' => true, 'items' => $items]);
    }

    public function crearMaterial(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $body = is_array($request->body) ? $request->body : [];
        $nombre = trim((string)($body['nombre'] ?? ''));
        if ($nombre === '') {
            Http::json(['error' => 'El nombre del material es obligatorio.'], 400);
        }

        $unidad = trim((string)($body['unidad'] ?? 'ud')) ?: 'ud';
        $stock = (int)($body['stock_actual'] ?? 0);
        if ($stock < 0) {
            Http::json(['error' => 'El stock inicial debe ser mayor o igual a 0.'], 400);
        }

        $precio = $body['precio_ref'] ?? null;
        if ($precio !== null && $precio !== '' && (!is_numeric($precio) || (float)$precio < 0)) {
            Http::json(['error' => 'El precio de referencia no es válido.'], 400);
        }

        $id = Uuid::v4();
        $pdo = Db::pdo();
        $st = $pdo->prepare('INSERT INTO inventario_materiales (id, nombre, descripcion, unidad, stock_actual, precio_ref, activo) VALUES (:id, :n, :d, :u, :s, :p, :a)');
        $st->execute([
            ':id' => $id,
            ':n' => $nombre,
            ':d' => $body['descripcion'] ?? null,
            ':u' => $unidad,
            ':s' => $stock,
            ':p' => ($precio === '' ? null : $precio),
            ':a' => isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
        ]);

        $this->registrarMovimiento($pdo, [
            'material_id' => $id,
            'tipo_movimiento' => 'alta',
            'cantidad' => $stock,
            'stock_anterior' => 0,
            'stock_nuevo' => $stock,
            'motivo' => 'Alta material',
        ]);

        $row = $pdo->prepare('SELECT id, nombre, descripcion, unidad, stock_actual, precio_ref, activo, creado_en FROM inventario_materiales WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
    }

    public function actualizarMaterial(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];
        if (array_key_exists('nombre', $body) && trim((string)$body['nombre']) === '') {
            Http::json(['error' => 'El nombre del material es obligatorio.'], 400);
        }
        if (array_key_exists('stock_actual', $body)) {
            $stock = (int)$body['stock_actual'];
            if ($stock < 0) {
                Http::json(['error' => 'El stock actual debe ser mayor o igual a 0.'], 400);
            }
        }
        if (array_key_exists('precio_ref', $body) && $body['precio_ref'] !== null && $body['precio_ref'] !== '' && (!is_numeric($body['precio_ref']) || (float)$body['precio_ref'] < 0)) {
            Http::json(['error' => 'El precio de referencia no es válido.'], 400);
        }

        $pdo = Db::pdo();
        $set = [];
        $bind = [':id' => $id];
        foreach (['nombre', 'descripcion', 'unidad', 'stock_actual', 'precio_ref', 'activo'] as $campo) {
            if (!array_key_exists($campo, $body)) {
                continue;
            }
            $set[] = $campo . ' = :' . $campo;
            if ($campo === 'activo') {
                $bind[':' . $campo] = (int)(bool)$body[$campo];
            } else {
                $bind[':' . $campo] = ($body[$campo] === '' ? null : $body[$campo]);
            }
        }
        if (count($set) === 0) {
            Http::json(['error' => 'No hay cambios para aplicar.'], 400);
        }
        $sql = 'UPDATE inventario_materiales SET ' . implode(', ', $set) . ' WHERE id = :id';
        $st = $pdo->prepare($sql);
        $st->execute($bind);

        $row = $pdo->prepare('SELECT id, nombre, descripcion, unidad, stock_actual, precio_ref, activo, creado_en FROM inventario_materiales WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
    }

    public function eliminarMaterial(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $pdo = Db::pdo();
        $st = $pdo->prepare('DELETE FROM inventario_materiales WHERE id = :id');
        $st->execute([':id' => $id]);
        Http::json(['ok' => true]);
    }

    public function regularizarStock(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];
        $modo = strtolower(trim((string)($body['modo'] ?? 'fijar')));
        $motivo = trim((string)($body['motivo'] ?? ''));
        $cantidad = (int)($body['cantidad'] ?? 0);
        if ($motivo === '') {
            Http::json(['error' => 'Debes indicar un motivo para la regularización.'], 400);
        }
        if ($cantidad < 0) {
            Http::json(['error' => 'La cantidad debe ser mayor o igual a 0.'], 400);
        }

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, stock_actual FROM inventario_materiales WHERE id = :id');
        $st->execute([':id' => $id]);
        $mat = $st->fetch();
        if (!$mat) {
            Http::json(['error' => 'No se encontró el material a regularizar.'], 404);
        }

        $stockAnterior = (int)$mat['stock_actual'];
        $stockNuevo = $stockAnterior;
        $cantidadMov = 0;
        if ($modo === 'fijar') {
            $stockNuevo = $cantidad;
            $cantidadMov = $stockNuevo - $stockAnterior;
        } elseif ($modo === 'sumar') {
            $stockNuevo = $stockAnterior + $cantidad;
            $cantidadMov = $cantidad;
        } elseif ($modo === 'restar') {
            if ($cantidad > $stockAnterior) {
                Http::json(['error' => 'No puedes restar más stock del disponible.'], 400);
            }
            $stockNuevo = $stockAnterior - $cantidad;
            $cantidadMov = -$cantidad;
        } else {
            Http::json(['error' => 'El modo de regularización no es válido.'], 400);
        }

        $up = $pdo->prepare('UPDATE inventario_materiales SET stock_actual = :s WHERE id = :id');
        $up->execute([':s' => $stockNuevo, ':id' => $id]);

        $this->registrarMovimiento($pdo, [
            'material_id' => $id,
            'tipo_movimiento' => 'regularizacion',
            'cantidad' => $cantidadMov,
            'stock_anterior' => $stockAnterior,
            'stock_nuevo' => $stockNuevo,
            'motivo' => $motivo,
        ]);

        $row = $pdo->prepare('SELECT id, nombre, descripcion, unidad, stock_actual, precio_ref, activo, creado_en FROM inventario_materiales WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
    }

    private function registrarMovimiento(\PDO $pdo, array $payload): void
    {
        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO inventario_movimientos (id, material_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo) VALUES (:id, :m, :t, :c, :sa, :sn, :mo)');
        $st->execute([
            ':id' => $id,
            ':m' => $payload['material_id'],
            ':t' => $payload['tipo_movimiento'],
            ':c' => (int)$payload['cantidad'],
            ':sa' => (int)$payload['stock_anterior'],
            ':sn' => (int)$payload['stock_nuevo'],
            ':mo' => $payload['motivo'] ?? null,
        ]);
    }
}

