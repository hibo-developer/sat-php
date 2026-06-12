<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class PartesController
{
    public function create(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $body = is_array($request->body) ? $request->body : [];

        $ordenId = trim((string)($body['orden_id'] ?? ''));
        $clienteId = trim((string)($body['cliente_id'] ?? ''));
        $equipoId = trim((string)($body['equipo_id'] ?? '')) ?: null;
        $clienteNombre = trim((string)($body['cliente_nombre'] ?? ''));
        $equipoNombre = trim((string)($body['equipo_nombre'] ?? ''));
        $tecnicoId = trim((string)($body['tecnico_id'] ?? ''));
        $descripcionProblema = trim((string)($body['descripcion_problema'] ?? ''));
        $nombreFirmante = trim((string)($body['nombre_firmante'] ?? ''));
        $prioridad = strtolower(trim((string)($body['prioridad'] ?? 'media')));
        $materialesTexto = (string)($body['materialesTexto'] ?? $body['materiales_texto'] ?? '');
        $materialesInventario = isset($body['materialesInventario']) && is_array($body['materialesInventario']) ? $body['materialesInventario'] : [];
        $tiempoEmpleado = (int)($body['tiempo_empleado'] ?? 0);
        $tareasLibre = trim((string)($body['tareas_realizadas_libre'] ?? ''));
        $firmaUrl = trim((string)($body['firma_url'] ?? ''));
        $fotosUrls = isset($body['fotos_intervencion']) && is_array($body['fotos_intervencion']) ? $body['fotos_intervencion'] : [];

        if ($tecnicoId === '') {
            Http::json(['error' => 'Debes asignar un técnico para registrar el parte.'], 400);
        }
        if (mb_strlen($descripcionProblema) < 8) {
            Http::json(['error' => 'La descripción del problema debe tener al menos 8 caracteres.'], 400);
        }
        if (mb_strlen($nombreFirmante) < 3) {
            Http::json(['error' => 'El nombre de la persona firmante es obligatorio.'], 400);
        }
        if ($firmaUrl === '') {
            Http::json(['error' => 'La firma del cliente es obligatoria para registrar el parte.'], 400);
        }
        if ($tiempoEmpleado <= 0) {
            Http::json(['error' => 'El tiempo empleado debe ser un número de minutos mayor que cero.'], 400);
        }
        if (!in_array($prioridad, ['baja', 'media', 'alta', 'urgente'], true)) {
            Http::json(['error' => 'La prioridad indicada no es válida.'], 400);
        }

        $pdo = Db::pdo();

        $pdo->beginTransaction();
        try {
            if ($ordenId === '' && $clienteId === '' && $clienteNombre !== '') {
                $clienteId = $this->resolverOCrearClientePorNombre($pdo, $clienteNombre);
            }
            if ($clienteId === '') {
                throw new \RuntimeException('Debes seleccionar o indicar un cliente para registrar el parte.');
            }
            if ($ordenId === '' && !$equipoId && $equipoNombre !== '') {
                $equipoId = $this->resolverOCrearEquipoPorNombre($pdo, $clienteId, $equipoNombre);
            }

            $this->validarReferencias($pdo, $clienteId, $equipoId, $tecnicoId);

            $fechaInicioIso = $this->resolverFechaDesdePayload($body['desplazamiento']['inicioIso'] ?? null, gmdate('c'));
            $fechaFinIso = $this->resolverFechaDesdePayload($body['intervension']['finIso'] ?? null, gmdate('c'));

            if ($ordenId !== '') {
                $orden = $this->getOrdenBasica($pdo, $ordenId);
                if (!$orden) {
                    throw new \RuntimeException('La orden seleccionada no existe.');
                }
                if ((string)$orden['estado'] === 'finalizado') {
                    throw new \RuntimeException('La orden seleccionada ya está finalizada.');
                }
                if ((string)$orden['cliente_id'] !== $clienteId) {
                    throw new \RuntimeException('La orden seleccionada no pertenece al cliente del parte.');
                }
                if ((string)$orden['tecnico_id'] !== $tecnicoId) {
                    throw new \RuntimeException('La orden seleccionada no está asignada al técnico elegido.');
                }
                if ((string)($orden['equipo_id'] ?? '') !== (string)($equipoId ?? '')) {
                    throw new \RuntimeException('El equipo del parte no coincide con el equipo de la orden seleccionada.');
                }
            } else {
                $ordenId = $this->crearOrdenImprevista($pdo, [
                    'cliente_id' => $clienteId,
                    'equipo_id' => $equipoId,
                    'tecnico_id' => $tecnicoId,
                    'descripcion_averia' => $descripcionProblema,
                    'prioridad' => $prioridad,
                    'estado' => 'pendiente',
                    'fecha_inicio' => $fechaInicioIso,
                ]);
            }

            $cantidadesPorMaterial = $this->agruparMaterialesInventario($materialesInventario);
            $inventarioMap = $this->cargarYValidarInventario($pdo, $cantidadesPorMaterial);

            if (($u['rol'] ?? '') === 'tecnico') {
                $tecUser = $this->tecnicoIdParaUserId($pdo, (string)$u['id']);
                if (!$tecUser || $tecUser !== $tecnicoId) {
                    throw new \RuntimeException('Acceso denegado.');
                }
            }

            $bloques = [];
            $desc = $tareasLibre !== '' ? $tareasLibre : 'Parte registrado desde movilidad';
            $bloques[] = $desc;

            $resumenDesplazamiento = $this->construirResumenDesplazamiento($body['desplazamiento'] ?? null);
            $resumenIntervension = $this->construirResumenIntervension($body['intervension'] ?? null);
            $resumenGeo = trim(implode(' | ', array_values(array_filter([$resumenDesplazamiento, $resumenIntervension], static fn($x) => $x))));
            if ($resumenGeo !== '') {
                $bloques[] = $resumenGeo;
            }
            $bloques[] = 'Firmado por: ' . $nombreFirmante;
            $fotosUrls = array_values(array_filter(array_map('trim', $fotosUrls), static fn($x) => $x !== ''));
            if (count($fotosUrls) > 0) {
                $bloques[] = 'Fotos intervención: ' . implode(' | ', $fotosUrls);
            }
            $tareasRealizadas = implode(' | ', $bloques);

            $kmMetros = $body['desplazamiento']['distanciaMetros'] ?? null;
            $kmFacturables = null;
            if (is_numeric($kmMetros) && (float)$kmMetros > 0) {
                $kmFacturables = round((((float)$kmMetros) * 2) / 1000, 2);
            }

            $fotoPrincipal = count($fotosUrls) > 0 ? $fotosUrls[0] : null;

            $up = $pdo->prepare('UPDATE ordenes_trabajo SET descripcion_averia = :d, tareas_realizadas = :t, tiempo_empleado_minutos = :min, mecanicos_intervinieron = :mec, estado = :e, prioridad = :p, foto_url = :foto, firma_url = :firma, fecha_inicio = :fi, fecha_fin = :ff, km_desplazamiento_facturables = COALESCE(:km, km_desplazamiento_facturables) WHERE id = :id');
            $up->execute([
                ':d' => $descripcionProblema,
                ':t' => $tareasRealizadas,
                ':min' => $tiempoEmpleado,
                ':mec' => max(1, (int)($body['mecanicos_intervinieron'] ?? 1)),
                ':e' => 'finalizado',
                ':p' => $prioridad,
                ':foto' => $fotoPrincipal,
                ':firma' => $firmaUrl,
                ':fi' => $this->isoToMysql($fechaInicioIso),
                ':ff' => $this->isoToMysql($fechaFinIso),
                ':km' => $kmFacturables,
                ':id' => $ordenId,
            ]);

            $del = $pdo->prepare('DELETE FROM materiales_orden WHERE orden_id = :id');
            $del->execute([':id' => $ordenId]);

            foreach ($cantidadesPorMaterial as $materialId => $cantidadTotal) {
                $mat = $inventarioMap[$materialId] ?? null;
                if (!$mat) {
                    throw new \RuntimeException('Uno de los materiales seleccionados ya no existe en inventario.');
                }
                $stockAnterior = (int)$mat['stock_actual'];
                $stockNuevo = $stockAnterior - $cantidadTotal;
                if ($stockNuevo < 0) {
                    throw new \RuntimeException('Stock insuficiente para ' . (string)$mat['nombre'] . '.');
                }
                $stUp = $pdo->prepare('UPDATE inventario_materiales SET stock_actual = :s WHERE id = :id AND stock_actual >= :min');
                $stUp->execute([':s' => $stockNuevo, ':id' => $materialId, ':min' => $cantidadTotal]);
                if ($stUp->rowCount() === 0) {
                    throw new \RuntimeException('No se pudo descontar stock de inventario.');
                }
                $this->registrarMovimiento($pdo, [
                    'material_id' => $materialId,
                    'tipo_movimiento' => 'salida',
                    'cantidad' => -$cantidadTotal,
                    'stock_anterior' => $stockAnterior,
                    'stock_nuevo' => $stockNuevo,
                    'motivo' => 'Uso en parte ' . $ordenId,
                ]);

                $this->insertarMaterialOrden($pdo, [
                    'orden_id' => $ordenId,
                    'material_id' => $materialId,
                    'nombre_material' => (string)$mat['nombre'],
                    'cantidad' => $cantidadTotal,
                    'precio_unitario' => $mat['precio_ref'] ?? null,
                ]);
            }

            foreach ($this->parsearMaterialesTexto($materialesTexto) as $m) {
                $this->insertarMaterialOrden($pdo, [
                    'orden_id' => $ordenId,
                    'material_id' => null,
                    'nombre_material' => $m['nombre_material'],
                    'cantidad' => $m['cantidad'],
                    'precio_unitario' => $m['precio_unitario'],
                ]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            Http::json(['error' => $e->getMessage() ?: 'No se pudo registrar el parte.'], 400);
        }

        Http::json([
            'orden_id' => $ordenId,
            'nombre_firmante' => $nombreFirmante,
            'fotos_intervencion_urls' => $fotosUrls,
        ]);
    }

    private function validarReferencias(\PDO $pdo, string $clienteId, ?string $equipoId, string $tecnicoId): void
    {
        $st = $pdo->prepare('SELECT id FROM clientes WHERE id = :id');
        $st->execute([':id' => $clienteId]);
        if (!$st->fetch()) {
            throw new \RuntimeException('El cliente seleccionado para el parte no existe.');
        }

        $st = $pdo->prepare('SELECT id, activo FROM tecnicos WHERE id = :id');
        $st->execute([':id' => $tecnicoId]);
        $tec = $st->fetch();
        if (!$tec) {
            throw new \RuntimeException('El técnico seleccionado para el parte no existe.');
        }
        if ((int)$tec['activo'] !== 1) {
            throw new \RuntimeException('El técnico seleccionado está inactivo.');
        }

        if ($equipoId) {
            $st = $pdo->prepare('SELECT id, cliente_id FROM equipos WHERE id = :id');
            $st->execute([':id' => $equipoId]);
            $eq = $st->fetch();
            if (!$eq) {
                throw new \RuntimeException('El equipo seleccionado para el parte no existe.');
            }
            if ((string)$eq['cliente_id'] !== $clienteId) {
                throw new \RuntimeException('El equipo seleccionado no pertenece al cliente del parte.');
            }
        }
    }

    private function getOrdenBasica(\PDO $pdo, string $id): ?array
    {
        $st = $pdo->prepare('SELECT id, cliente_id, equipo_id, tecnico_id, estado FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        $row = $st->fetch();
        return $row ?: null;
    }

    private function crearOrdenImprevista(\PDO $pdo, array $data): string
    {
        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO ordenes_trabajo (id, cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio) VALUES (:id, :c, :e, :t, :d, :estado, :p, :fi)');
        $st->execute([
            ':id' => $id,
            ':c' => $data['cliente_id'],
            ':e' => $data['equipo_id'],
            ':t' => $data['tecnico_id'],
            ':d' => $data['descripcion_averia'],
            ':estado' => $data['estado'],
            ':p' => $data['prioridad'],
            ':fi' => $this->isoToMysql((string)$data['fecha_inicio']),
        ]);
        return $id;
    }

    private function agruparMaterialesInventario(array $items): array
    {
        $map = [];
        foreach ($items as $idx => $item) {
            if (!is_array($item)) {
                throw new \RuntimeException('El material de inventario en la posición ' . ($idx + 1) . ' no es válido.');
            }
            $mid = trim((string)($item['material_id'] ?? ''));
            $cant = (int)($item['cantidad'] ?? 0);
            if ($mid === '') {
                throw new \RuntimeException('El material de inventario en la posición ' . ($idx + 1) . ' no es válido.');
            }
            if ($cant <= 0) {
                throw new \RuntimeException('La cantidad del material de inventario en la posición ' . ($idx + 1) . ' debe ser mayor que cero.');
            }
            $map[$mid] = ($map[$mid] ?? 0) + $cant;
        }
        return $map;
    }

    private function cargarYValidarInventario(\PDO $pdo, array $cantidades): array
    {
        if (count($cantidades) === 0) {
            return [];
        }
        $ids = array_keys($cantidades);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $st = $pdo->prepare("SELECT id, nombre, precio_ref, stock_actual, activo FROM inventario_materiales WHERE id IN ({$in})");
        $st->execute($ids);
        $rows = $st->fetchAll() ?: [];
        $map = [];
        foreach ($rows as $r) {
            $map[(string)$r['id']] = $r;
        }
        foreach ($ids as $id) {
            $mat = $map[$id] ?? null;
            if (!$mat) {
                throw new \RuntimeException('Uno de los materiales seleccionados ya no existe en inventario.');
            }
            if ((int)$mat['activo'] !== 1) {
                throw new \RuntimeException('El material ' . (string)$mat['nombre'] . ' está inactivo en inventario.');
            }
            $need = (int)($cantidades[$id] ?? 0);
            if ((int)$mat['stock_actual'] < $need) {
                throw new \RuntimeException('Stock insuficiente para ' . (string)$mat['nombre'] . '. Disponible: ' . (string)$mat['stock_actual'] . '.');
            }
        }
        return $map;
    }

    private function parsearMaterialesTexto(string $texto): array
    {
        $t = trim((string)$texto);
        if ($t === '') {
            return [];
        }
        $lineas = preg_split('/\r?\n/', $t) ?: [];
        $out = [];
        foreach ($lineas as $i => $linea) {
            $l = trim($linea);
            if ($l === '') {
                continue;
            }
            $parts = array_map('trim', explode(';', $l));
            $nombre = $parts[0] ?? '';
            $cantRaw = $parts[1] ?? '';
            $precioRaw = $parts[2] ?? '';
            if ($nombre === '') {
                throw new \RuntimeException('El material de la línea ' . ($i + 1) . ' no tiene nombre.');
            }
            $cant = $cantRaw !== '' ? (int)$cantRaw : 1;
            if ($cant <= 0) {
                throw new \RuntimeException('La cantidad del material en la línea ' . ($i + 1) . ' debe ser mayor que cero.');
            }
            $precio = null;
            if ($precioRaw !== '') {
                if (!is_numeric($precioRaw)) {
                    throw new \RuntimeException('El precio del material en la línea ' . ($i + 1) . ' no es válido.');
                }
                $precio = (float)$precioRaw;
            }
            $out[] = [
                'nombre_material' => $nombre,
                'cantidad' => $cant,
                'precio_unitario' => $precio,
            ];
        }
        return $out;
    }

    private function insertarMaterialOrden(\PDO $pdo, array $data): void
    {
        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO materiales_orden (id, orden_id, material_id, nombre_material, cantidad, precio_unitario) VALUES (:id, :o, :m, :n, :c, :p)');
        $st->execute([
            ':id' => $id,
            ':o' => $data['orden_id'],
            ':m' => $data['material_id'],
            ':n' => $data['nombre_material'],
            ':c' => (int)$data['cantidad'],
            ':p' => $data['precio_unitario'],
        ]);
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

    private function resolverOCrearClientePorNombre(\PDO $pdo, string $nombreCliente): string
    {
        $nombre = preg_replace('/\s+/', ' ', trim($nombreCliente)) ?: '';
        if ($nombre === '') {
            throw new \RuntimeException('Debes indicar un cliente válido.');
        }
        $st = $pdo->prepare('SELECT id FROM clientes WHERE LOWER(nombre) = LOWER(:n) LIMIT 1');
        $st->execute([':n' => $nombre]);
        $row = $st->fetch();
        if ($row) {
            return (string)$row['id'];
        }
        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO clientes (id, nombre) VALUES (:id, :n)');
        $st->execute([':id' => $id, ':n' => $nombre]);
        return $id;
    }

    private function resolverOCrearEquipoPorNombre(\PDO $pdo, string $clienteId, string $nombreEquipo): string
    {
        $nombre = preg_replace('/\s+/', ' ', trim($nombreEquipo)) ?: '';
        if ($nombre === '') {
            return '';
        }
        $st = $pdo->prepare('SELECT id FROM equipos WHERE cliente_id = :c AND LOWER(nombre) = LOWER(:n) LIMIT 1');
        $st->execute([':c' => $clienteId, ':n' => $nombre]);
        $row = $st->fetch();
        if ($row) {
            return (string)$row['id'];
        }
        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO equipos (id, cliente_id, nombre, marca, modelo) VALUES (:id, :c, :n, NULL, NULL)');
        $st->execute([':id' => $id, ':c' => $clienteId, ':n' => $nombre]);
        return $id;
    }

    private function tecnicoIdParaUserId(\PDO $pdo, string $userId): ?string
    {
        $st = $pdo->prepare('SELECT id FROM tecnicos WHERE user_id = :u LIMIT 1');
        $st->execute([':u' => $userId]);
        $row = $st->fetch();
        return $row ? (string)$row['id'] : null;
    }

    private function resolverFechaDesdePayload(mixed $valor, string $fallbackIso): string
    {
        if (!is_string($valor) || trim($valor) === '') {
            return $fallbackIso;
        }
        $ts = strtotime($valor);
        if ($ts === false) {
            return $fallbackIso;
        }
        return gmdate('c', $ts);
    }

    private function isoToMysql(string $iso): string
    {
        $ts = strtotime($iso);
        if ($ts === false) {
            return gmdate('Y-m-d H:i:s');
        }
        return gmdate('Y-m-d H:i:s', $ts);
    }

    private function construirResumenDesplazamiento(mixed $desplazamiento): ?string
    {
        if (!is_array($desplazamiento) || empty($desplazamiento['inicioIso'])) {
            return null;
        }
        $lineas = ['Desplazamiento Cotepa a cliente'];
        $lineas[] = 'Inicio: ' . (string)$desplazamiento['inicioIso'];
        if (!empty($desplazamiento['finIso'])) {
            $lineas[] = 'Fin: ' . (string)$desplazamiento['finIso'];
        }
        if (isset($desplazamiento['distanciaMetros']) && is_numeric($desplazamiento['distanciaMetros'])) {
            $km = round(((float)$desplazamiento['distanciaMetros']) / 1000, 2);
            $lineas[] = 'Distancia desplazamiento: ' . number_format($km, 2, '.', '') . ' km | Factura (ida+vuelta): ' . number_format($km, 2, '.', '') . ' km';
        }
        return implode(' | ', $lineas);
    }

    private function construirResumenIntervension(mixed $intervension): ?string
    {
        if (!is_array($intervension) || empty($intervension['inicioIso'])) {
            return null;
        }
        $lineas = ['Intervención en cliente'];
        $lineas[] = 'Inicio: ' . (string)$intervension['inicioIso'];
        if (!empty($intervension['finIso'])) {
            $lineas[] = 'Fin: ' . (string)$intervension['finIso'];
        }
        if (isset($intervension['minutosGeo']) && is_numeric($intervension['minutosGeo'])) {
            $lineas[] = 'Tiempo intervención: ' . (string)(int)$intervension['minutosGeo'] . ' minutos';
        }
        return implode(' | ', $lineas);
    }
}

