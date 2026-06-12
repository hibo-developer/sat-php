<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class OrdenesController
{
    private const ESTADOS_EDITABLES = ['pendiente', 'en_proceso', 'pausado'];
    private const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

    public function index(Request $request, array $params): void
    {
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $rol = (string)($u['rol'] ?? '');
        $pdo = Db::pdo();

        $where = '';
        $bind = [];
        if ($rol === 'tecnico') {
            $tecnicoId = $this->tecnicoIdParaUserId((string)$u['id']);
            if (!$tecnicoId) {
                Http::json([]);
            }
            $where = 'WHERE o.tecnico_id = :tecnico_id';
            $bind[':tecnico_id'] = $tecnicoId;
        }

        $sql = "SELECT
                    o.*,
                    c.id AS c_id, c.nombre AS c_nombre, c.direccion AS c_direccion, c.telefono AS c_telefono, c.lat AS c_lat, c.lng AS c_lng,
                    e.id AS e_id, e.nombre AS e_nombre, e.marca AS e_marca, e.modelo AS e_modelo,
                    t.id AS t_id, t.nombre AS t_nombre,
                    m.id AS m_id, m.nombre_material AS m_nombre_material, m.cantidad AS m_cantidad, m.precio_unitario AS m_precio_unitario
                FROM ordenes_trabajo o
                JOIN clientes c ON c.id = o.cliente_id
                LEFT JOIN equipos e ON e.id = o.equipo_id
                JOIN tecnicos t ON t.id = o.tecnico_id
                LEFT JOIN materiales_orden m ON m.orden_id = o.id
                {$where}
                ORDER BY o.fecha_inicio DESC";
        $st = $pdo->prepare($sql);
        $st->execute($bind);
        $rows = $st->fetchAll() ?: [];
        Http::json($this->agruparOrdenes($rows));
    }

    public function create(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $body = is_array($request->body) ? $request->body : [];

        $clienteId = trim((string)($body['cliente_id'] ?? ''));
        $equipoId = trim((string)($body['equipo_id'] ?? '')) ?: null;
        $tecnicoId = trim((string)($body['tecnico_id'] ?? ''));
        $descripcion = trim((string)($body['descripcion_averia'] ?? ''));
        $prioridad = strtolower(trim((string)($body['prioridad'] ?? 'media')));
        $estado = strtolower(trim((string)($body['estado'] ?? 'pendiente')));

        if ($clienteId === '') {
            Http::json(['error' => 'Debes seleccionar un cliente para crear la orden.'], 400);
        }
        if ($tecnicoId === '') {
            Http::json(['error' => 'Debes asignar un técnico antes de crear la orden.'], 400);
        }
        if (mb_strlen($descripcion) < 8) {
            Http::json(['error' => 'La descripción de la avería debe tener al menos 8 caracteres.'], 400);
        }
        if (!in_array($prioridad, self::PRIORIDADES, true)) {
            Http::json(['error' => 'La prioridad indicada no es válida.'], 400);
        }
        if (!in_array($estado, array_merge(self::ESTADOS_EDITABLES, ['finalizado']), true)) {
            Http::json(['error' => 'El estado indicado no es válido.'], 400);
        }

        $pdo = Db::pdo();
        if (!$this->existe($pdo, 'clientes', $clienteId)) {
            Http::json(['error' => 'El cliente seleccionado no existe.'], 400);
        }
        if ($equipoId) {
            $st = $pdo->prepare('SELECT id, cliente_id FROM equipos WHERE id = :id');
            $st->execute([':id' => $equipoId]);
            $eq = $st->fetch();
            if (!$eq) {
                Http::json(['error' => 'El equipo seleccionado no existe.'], 400);
            }
            if ((string)$eq['cliente_id'] !== $clienteId) {
                Http::json(['error' => 'El equipo seleccionado no pertenece al cliente indicado.'], 400);
            }
        }
        $st = $pdo->prepare('SELECT id, activo FROM tecnicos WHERE id = :id');
        $st->execute([':id' => $tecnicoId]);
        $tec = $st->fetch();
        if (!$tec) {
            Http::json(['error' => 'El técnico seleccionado no existe.'], 400);
        }
        if ((int)$tec['activo'] !== 1) {
            Http::json(['error' => 'El técnico seleccionado está inactivo.'], 400);
        }

        $this->validarOrdenDuplicada($pdo, $clienteId, $equipoId, $descripcion);

        $id = Uuid::v4();
        $fechaInicio = $body['fecha_inicio'] ?? gmdate('Y-m-d\TH:i:s\Z');
        $st = $pdo->prepare('INSERT INTO ordenes_trabajo (id, cliente_id, equipo_id, tecnico_id, descripcion_averia, tareas_realizadas, tiempo_empleado_minutos, estado, prioridad, foto_url, firma_url, fecha_inicio, fecha_fin) VALUES (:id, :c, :e, :t, :d, :tr, :min, :estado, :p, :foto, :firma, :fi, :ff)');
        $st->execute([
            ':id' => $id,
            ':c' => $clienteId,
            ':e' => $equipoId,
            ':t' => $tecnicoId,
            ':d' => $descripcion,
            ':tr' => $body['tareas_realizadas'] ?? null,
            ':min' => $body['tiempo_empleado_minutos'] ?? null,
            ':estado' => $estado,
            ':p' => $prioridad,
            ':foto' => $body['foto_url'] ?? null,
            ':firma' => $body['firma_url'] ?? null,
            ':fi' => $this->isoToMysql($fechaInicio),
            ':ff' => $body['fecha_fin'] ? $this->isoToMysql((string)$body['fecha_fin']) : null,
        ]);

        $orden = $this->getOrdenCompleta($pdo, $id);
        Http::json($orden);
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
        $tecnicoId = trim((string)($body['tecnico_id'] ?? ''));
        $prioridad = strtolower(trim((string)($body['prioridad'] ?? 'media')));
        $estado = strtolower(trim((string)($body['estado'] ?? 'pendiente')));
        $expectedUpdatedAt = trim((string)($request->query['expectedUpdatedAt'] ?? ''));

        if ($tecnicoId === '') {
            Http::json(['error' => 'Debes asignar un técnico válido a la orden.'], 400);
        }
        if (!in_array($prioridad, self::PRIORIDADES, true)) {
            Http::json(['error' => 'La prioridad indicada no es válida.'], 400);
        }
        if (!in_array($estado, self::ESTADOS_EDITABLES, true)) {
            Http::json(['error' => 'El estado seleccionado no es válido para una orden abierta.'], 400);
        }

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, estado, updated_at FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        $orden = $st->fetch();
        if (!$orden) {
            Http::json(['error' => 'La orden que intentas editar ya no existe.'], 404);
        }
        if ((string)$orden['estado'] === 'finalizado') {
            Http::json(['error' => 'No se puede editar una orden que ya está finalizada.'], 400);
        }

        $st = $pdo->prepare('SELECT id, activo FROM tecnicos WHERE id = :id');
        $st->execute([':id' => $tecnicoId]);
        $tec = $st->fetch();
        if (!$tec || (int)$tec['activo'] !== 1) {
            Http::json(['error' => 'El técnico seleccionado no existe o está inactivo.'], 400);
        }

        $sql = 'UPDATE ordenes_trabajo SET tecnico_id = :t, prioridad = :p, estado = :e WHERE id = :id';
        $bind = [':t' => $tecnicoId, ':p' => $prioridad, ':e' => $estado, ':id' => $id];
        if ($expectedUpdatedAt !== '') {
            $sql .= ' AND updated_at = :ua';
            $bind[':ua'] = $expectedUpdatedAt;
        }
        $st = $pdo->prepare($sql);
        $st->execute($bind);
        if ($expectedUpdatedAt !== '' && $st->rowCount() === 0) {
            Http::json(['error' => 'Conflicto: la orden cambió mientras estabas offline.'], 409);
        }

        $orden = $this->getOrdenCompleta($pdo, $id);
        Http::json($orden);
    }

    public function delete(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $pdo = Db::pdo();
        $st = $pdo->prepare('DELETE FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        Http::json(['ok' => true]);
    }

    public function finalizar(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'La orden que intentas finalizar no es válida.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];
        $tareas = trim((string)($body['tareasRealizadas'] ?? $body['tareas_realizadas'] ?? ''));
        $minutos = (int)($body['tiempoEmpleadoMinutos'] ?? $body['tiempo_empleado_minutos'] ?? 0);
        $foto = isset($body['fotoUrl']) ? trim((string)$body['fotoUrl']) : (isset($body['foto_url']) ? trim((string)$body['foto_url']) : null);

        if (mb_strlen($tareas) < 8) {
            Http::json(['error' => 'Las tareas realizadas deben tener al menos 8 caracteres.'], 400);
        }
        if ($minutos <= 0) {
            Http::json(['error' => 'El tiempo de cierre debe ser un número de minutos mayor que cero.'], 400);
        }

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, tecnico_id, estado FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        $orden = $st->fetch();
        if (!$orden) {
            Http::json(['error' => 'La orden que intentas finalizar ya no existe.'], 404);
        }
        if ((string)$orden['estado'] === 'finalizado') {
            Http::json(['error' => 'La orden seleccionada ya está finalizada.'], 400);
        }
        if (($u['rol'] ?? '') === 'tecnico') {
            $tecnicoId = $this->tecnicoIdParaUserId((string)$u['id']);
            if (!$tecnicoId || $tecnicoId !== (string)$orden['tecnico_id']) {
                Http::json(['error' => 'Solo puedes operar órdenes asignadas a tu técnico.'], 403);
            }
        }

        $st = $pdo->prepare('UPDATE ordenes_trabajo SET estado = :e, tareas_realizadas = :t, tiempo_empleado_minutos = :m, foto_url = :f, fecha_fin = :ff WHERE id = :id');
        $st->execute([
            ':e' => 'finalizado',
            ':t' => $tareas,
            ':m' => $minutos,
            ':f' => ($foto !== '' ? $foto : null),
            ':ff' => gmdate('Y-m-d H:i:s'),
            ':id' => $id,
        ]);

        Http::json($this->getOrdenCompleta($pdo, $id));
    }

    public function valoracion(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, estado, mecanicos_intervinieron FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        $orden = $st->fetch();
        if (!$orden) {
            Http::json(['error' => 'La orden no existe.'], 404);
        }
        if ((string)$orden['estado'] !== 'finalizado') {
            Http::json(['error' => 'Solo se puede valorar una orden finalizada.'], 400);
        }

        $mecanicos = max(1, (int)($orden['mecanicos_intervinieron'] ?? 1));

        $tarifaManoObra = $this->num($body['tarifa_mano_obra_hora'] ?? null, true, 'tarifa_mano_obra_hora');
        $horasManoObra = $this->num($body['horas_mano_obra'] ?? null, true, 'horas_mano_obra');
        $tarifaKm = $this->num($body['tarifa_desplazamiento_km'] ?? null, true, 'tarifa_desplazamiento_km');
        $kmFact = $this->num($body['km_desplazamiento_facturables'] ?? null, true, 'km_desplazamiento_facturables');

        $recFest = $this->num($body['recargo_festivo_pct'] ?? 25, true, 'recargo_festivo_pct');
        $recFuera = $this->num($body['recargo_fuera_horario_pct'] ?? 20, true, 'recargo_fuera_horario_pct');
        $apFest = array_key_exists('aplica_recargo_festivo', $body) ? (bool)$body['aplica_recargo_festivo'] : false;
        $apFuera = array_key_exists('aplica_recargo_fuera_horario', $body) ? (bool)$body['aplica_recargo_fuera_horario'] : false;

        $recargoTotalPct = ($apFest ? $recFest : 0.0) + ($apFuera ? $recFuera : 0.0);
        $mult = 1.0 + ($recargoTotalPct / 100.0);

        $costeMaterialesEditable = $body['coste_materiales_editable'] ?? null;
        $costeMateriales = null;
        if ($costeMaterialesEditable !== null && $costeMaterialesEditable !== '') {
            $costeMateriales = $this->num($costeMaterialesEditable, true, 'coste_materiales_editable');
        } else {
            $st = $pdo->prepare('SELECT COALESCE(SUM(cantidad * COALESCE(precio_unitario, 0)), 0) AS total FROM materiales_orden WHERE orden_id = :id');
            $st->execute([':id' => $id]);
            $row = $st->fetch();
            $costeMateriales = $row ? (float)$row['total'] : 0.0;
        }

        $costeMano = round($tarifaManoObra * $horasManoObra * $mecanicos * $mult, 2);
        $costeDespl = round($tarifaKm * $kmFact * $mult, 2);
        $costeTotal = round($costeMateriales + $costeMano + $costeDespl, 2);

        $st = $pdo->prepare('UPDATE ordenes_trabajo
                             SET coste_materiales_editable = :cm,
                                 tarifa_mano_obra_hora = :tmo,
                                 horas_mano_obra = :hmo,
                                 tarifa_desplazamiento_km = :tdk,
                                 km_desplazamiento_facturables = :km,
                                 recargo_festivo_pct = :rf,
                                 recargo_fuera_horario_pct = :rfo,
                                 aplica_recargo_festivo = :af,
                                 aplica_recargo_fuera_horario = :afo,
                                 coste_mano_obra_total = :cmo,
                                 coste_desplazamiento_total = :cd,
                                 coste_total = :ct
                             WHERE id = :id');
        $st->execute([
            ':cm' => ($costeMaterialesEditable !== null && $costeMaterialesEditable !== '') ? $costeMateriales : null,
            ':tmo' => $tarifaManoObra,
            ':hmo' => $horasManoObra,
            ':tdk' => $tarifaKm,
            ':km' => $kmFact,
            ':rf' => $recFest,
            ':rfo' => $recFuera,
            ':af' => $apFest ? 1 : 0,
            ':afo' => $apFuera ? 1 : 0,
            ':cmo' => $costeMano,
            ':cd' => $costeDespl,
            ':ct' => $costeTotal,
            ':id' => $id,
        ]);

        Http::json($this->getOrdenCompleta($pdo, $id));
    }

    public function editarParte(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin']);
        $id = (string)($params['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'ID inválido.'], 400);
        }
        $body = is_array($request->body) ? $request->body : [];
        $descripcion = array_key_exists('descripcion_averia', $body)
            ? trim((string)($body['descripcion_averia'] ?? ''))
            : (array_key_exists('descripcion_problema', $body) ? trim((string)($body['descripcion_problema'] ?? '')) : null);
        $tareasLibre = array_key_exists('tareas_realizadas_libre', $body) ? trim((string)($body['tareas_realizadas_libre'] ?? '')) : null;
        $fotosEliminar = isset($body['fotos_eliminar']) && is_array($body['fotos_eliminar'])
            ? $body['fotos_eliminar']
            : ((isset($body['fotos_a_eliminar']) && is_array($body['fotos_a_eliminar'])) ? $body['fotos_a_eliminar'] : []);
        $fotosNuevas = isset($body['fotos_nuevas']) && is_array($body['fotos_nuevas']) ? $body['fotos_nuevas'] : [];
        $materiales = isset($body['materiales']) && is_array($body['materiales']) ? $body['materiales'] : [];

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id, estado, descripcion_averia, tareas_realizadas, foto_url FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $id]);
        $orden = $st->fetch();
        if (!$orden) {
            Http::json(['error' => 'La orden no existe.'], 404);
        }
        if ((string)$orden['estado'] !== 'finalizado') {
            Http::json(['error' => 'Solo se puede editar el parte de una orden finalizada.'], 400);
        }

        $tareasActual = (string)($orden['tareas_realizadas'] ?? '');
        $regex = '/Fotos intervención:\s*(.+)$/i';
        $fotosActuales = [];
        $baseTareas = trim($tareasActual);
        if (preg_match($regex, $tareasActual, $m, PREG_OFFSET_CAPTURE)) {
            $idx = (int)$m[0][1];
            $baseTareas = trim(substr($tareasActual, 0, $idx));
            $lista = (string)($m[1][0] ?? '');
            $fotosActuales = array_values(array_filter(array_map('trim', explode('|', $lista)), static fn($x) => $x !== ''));
        }

        $fotosEliminar = array_values(array_filter(array_map('trim', $fotosEliminar), static fn($x) => $x !== ''));
        $fotosNuevas = array_values(array_filter(array_map('trim', $fotosNuevas), static fn($x) => $x !== ''));

        $fotosFinal = array_values(array_filter($fotosActuales, static fn($u) => !in_array($u, $fotosEliminar, true)));
        foreach ($fotosNuevas as $u) {
            if (!in_array($u, $fotosFinal, true)) {
                $fotosFinal[] = $u;
            }
        }

        if ($tareasLibre !== null && $tareasLibre !== '') {
            $segmentos = array_values(array_filter(array_map('trim', explode(' | ', $baseTareas)), static fn($x) => $x !== ''));
            if (count($segmentos) === 0) {
                $segmentos = [$tareasLibre];
            } else {
                $segmentos[0] = $tareasLibre;
            }
            $baseTareas = implode(' | ', $segmentos);
        }

        $tareasNueva = $baseTareas;
        if (count($fotosFinal) > 0) {
            $tareasNueva = rtrim($tareasNueva, " \t\n\r\0\x0B|");
            $tareasNueva = $tareasNueva . ' | Fotos intervención: ' . implode(' | ', $fotosFinal);
        }

        $fotoPrincipal = count($fotosFinal) > 0 ? $fotosFinal[0] : null;

        $setDesc = ($descripcion !== null && $descripcion !== '') ? $descripcion : (string)$orden['descripcion_averia'];
        $st = $pdo->prepare('UPDATE ordenes_trabajo SET descripcion_averia = :d, tareas_realizadas = :t, foto_url = :f WHERE id = :id');
        $st->execute([
            ':d' => $setDesc,
            ':t' => $tareasNueva,
            ':f' => $fotoPrincipal,
            ':id' => $id,
        ]);

        if (count($materiales) > 0) {
            $del = $pdo->prepare('DELETE FROM materiales_orden WHERE orden_id = :id');
            $del->execute([':id' => $id]);
            foreach ($materiales as $idx => $m) {
                if (!is_array($m)) {
                    Http::json(['error' => 'Material inválido en la posición ' . ($idx + 1) . '.'], 400);
                }
                $nombre = trim((string)($m['nombre_material'] ?? ''));
                $cantidad = (int)($m['cantidad'] ?? 0);
                $precio = $m['precio_unitario'] ?? null;
                if ($nombre === '') {
                    Http::json(['error' => 'El material de la posición ' . ($idx + 1) . ' no tiene nombre.'], 400);
                }
                if ($cantidad <= 0) {
                    Http::json(['error' => 'La cantidad del material de la posición ' . ($idx + 1) . ' debe ser mayor que cero.'], 400);
                }
                if ($precio !== null && $precio !== '' && !is_numeric($precio)) {
                    Http::json(['error' => 'El precio del material de la posición ' . ($idx + 1) . ' no es válido.'], 400);
                }
                $mid = \Sat\Api\Uuid::v4();
                $stIns = $pdo->prepare('INSERT INTO materiales_orden (id, orden_id, material_id, nombre_material, cantidad, precio_unitario) VALUES (:id, :o, NULL, :n, :c, :p)');
                $stIns->execute([
                    ':id' => $mid,
                    ':o' => $id,
                    ':n' => $nombre,
                    ':c' => $cantidad,
                    ':p' => ($precio === '' ? null : $precio),
                ]);
            }
        }

        Http::json($this->getOrdenCompleta($pdo, $id));
    }

    private function num(mixed $v, bool $allowZero, string $campo): float
    {
        if ($v === null || $v === '') {
            Http::json(['error' => $campo . ' es obligatorio.'], 400);
        }
        if (!is_numeric($v)) {
            Http::json(['error' => $campo . ' no es numérico.'], 400);
        }
        $n = (float)$v;
        if (!$allowZero && $n <= 0) {
            Http::json(['error' => $campo . ' debe ser mayor que cero.'], 400);
        }
        if ($allowZero && $n < 0) {
            Http::json(['error' => $campo . ' debe ser mayor o igual a 0.'], 400);
        }
        return $n;
    }

    public function guardarInforme(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        Auth::requireRole(['admin', 'oficina']);
        $id = (string)($params['id'] ?? '');
        $body = is_array($request->body) ? $request->body : [];
        $pdfUrl = trim((string)($body['pdfUrl'] ?? $body['informe_pdf_url'] ?? ''));
        if ($id === '' || $pdfUrl === '') {
            Http::json(['error' => 'ID de orden y pdfUrl son obligatorios.'], 400);
        }
        $pdo = Db::pdo();
        $st = $pdo->prepare('UPDATE ordenes_trabajo SET informe_pdf_url = :u WHERE id = :id');
        $st->execute([':u' => $pdfUrl, ':id' => $id]);
        Http::json(['ok' => true]);
    }

    private function agruparOrdenes(array $rows): array
    {
        $map = [];
        foreach ($rows as $r) {
            $id = (string)$r['id'];
            if (!isset($map[$id])) {
                $map[$id] = $this->rowBaseOrden($r);
                $map[$id]['materiales_orden'] = [];
            }
            if (!empty($r['m_id'])) {
                $map[$id]['materiales_orden'][] = [
                    'id' => (string)$r['m_id'],
                    'nombre_material' => (string)$r['m_nombre_material'],
                    'cantidad' => (int)$r['m_cantidad'],
                    'precio_unitario' => $r['m_precio_unitario'] !== null ? (float)$r['m_precio_unitario'] : null,
                ];
            }
        }
        return array_values($map);
    }

    private function getOrdenCompleta(\PDO $pdo, string $id): ?array
    {
        $sql = "SELECT
                    o.*,
                    c.id AS c_id, c.nombre AS c_nombre, c.direccion AS c_direccion, c.telefono AS c_telefono, c.lat AS c_lat, c.lng AS c_lng,
                    e.id AS e_id, e.nombre AS e_nombre, e.marca AS e_marca, e.modelo AS e_modelo,
                    t.id AS t_id, t.nombre AS t_nombre,
                    m.id AS m_id, m.nombre_material AS m_nombre_material, m.cantidad AS m_cantidad, m.precio_unitario AS m_precio_unitario
                FROM ordenes_trabajo o
                JOIN clientes c ON c.id = o.cliente_id
                LEFT JOIN equipos e ON e.id = o.equipo_id
                JOIN tecnicos t ON t.id = o.tecnico_id
                LEFT JOIN materiales_orden m ON m.orden_id = o.id
                WHERE o.id = :id";
        $st = $pdo->prepare($sql);
        $st->execute([':id' => $id]);
        $rows = $st->fetchAll() ?: [];
        if (count($rows) === 0) {
            return null;
        }
        $grouped = $this->agruparOrdenes($rows);
        return $grouped[0] ?? null;
    }

    private function rowBaseOrden(array $r): array
    {
        return [
            'id' => (string)$r['id'],
            'updated_at' => $this->mysqlToIso($r['updated_at'] ?? null),
            'numero_ticket' => (int)$r['numero_ticket'],
            'descripcion_averia' => (string)$r['descripcion_averia'],
            'tareas_realizadas' => $r['tareas_realizadas'],
            'tiempo_empleado_minutos' => $r['tiempo_empleado_minutos'] !== null ? (int)$r['tiempo_empleado_minutos'] : null,
            'coste_materiales_editable' => $r['coste_materiales_editable'],
            'tarifa_mano_obra_hora' => $r['tarifa_mano_obra_hora'],
            'horas_mano_obra' => $r['horas_mano_obra'],
            'mecanicos_intervinieron' => $r['mecanicos_intervinieron'],
            'tarifa_desplazamiento_km' => $r['tarifa_desplazamiento_km'],
            'km_desplazamiento_facturables' => $r['km_desplazamiento_facturables'],
            'recargo_festivo_pct' => $r['recargo_festivo_pct'],
            'recargo_fuera_horario_pct' => $r['recargo_fuera_horario_pct'],
            'aplica_recargo_festivo' => $r['aplica_recargo_festivo'] !== null ? (bool)$r['aplica_recargo_festivo'] : null,
            'aplica_recargo_fuera_horario' => $r['aplica_recargo_fuera_horario'] !== null ? (bool)$r['aplica_recargo_fuera_horario'] : null,
            'coste_mano_obra_total' => $r['coste_mano_obra_total'],
            'coste_desplazamiento_total' => $r['coste_desplazamiento_total'],
            'coste_total' => $r['coste_total'],
            'estado' => (string)$r['estado'],
            'prioridad' => (string)$r['prioridad'],
            'foto_url' => $r['foto_url'],
            'firma_url' => $r['firma_url'],
            'informe_pdf_url' => $r['informe_pdf_url'],
            'fecha_inicio' => $this->mysqlToIso($r['fecha_inicio'] ?? null),
            'fecha_fin' => $this->mysqlToIso($r['fecha_fin'] ?? null),
            'desplazamiento_inicio' => $this->mysqlToIso($r['desplazamiento_inicio'] ?? null),
            'desplazamiento_fin' => $this->mysqlToIso($r['desplazamiento_fin'] ?? null),
            'intervension_inicio' => $this->mysqlToIso($r['intervension_inicio'] ?? null),
            'intervension_fin' => $this->mysqlToIso($r['intervension_fin'] ?? null),
            'clientes' => [
                'id' => (string)$r['c_id'],
                'nombre' => (string)$r['c_nombre'],
                'direccion' => $r['c_direccion'],
                'telefono' => $r['c_telefono'],
                'lat' => $r['c_lat'],
                'lng' => $r['c_lng'],
            ],
            'equipos' => $r['e_id'] ? [
                'id' => (string)$r['e_id'],
                'nombre' => (string)$r['e_nombre'],
                'marca' => $r['e_marca'],
                'modelo' => $r['e_modelo'],
            ] : null,
            'tecnicos' => [
                'id' => (string)$r['t_id'],
                'nombre' => (string)$r['t_nombre'],
            ],
        ];
    }

    private function validarOrdenDuplicada(\PDO $pdo, string $clienteId, ?string $equipoId, string $descripcion): void
    {
        $st = $pdo->prepare("SELECT id, descripcion_averia, equipo_id
                             FROM ordenes_trabajo
                             WHERE cliente_id = :c AND estado IN ('pendiente','en_proceso','pausado')
                             ORDER BY fecha_inicio DESC
                             LIMIT 25");
        $st->execute([':c' => $clienteId]);
        $rows = $st->fetchAll() ?: [];
        $descNueva = $this->normalizarDescripcion($descripcion);
        foreach ($rows as $r) {
            $misma = $this->normalizarDescripcion((string)$r['descripcion_averia']) === $descNueva;
            $mismoEquipo = !$equipoId || !$r['equipo_id'] || (string)$r['equipo_id'] === $equipoId;
            if ($misma && $mismoEquipo) {
                Http::json(['error' => 'Ya existe una orden abierta con la misma avería para este cliente.'], 400);
            }
        }
    }

    private function normalizarDescripcion(string $v): string
    {
        $x = mb_strtolower(trim($v));
        $x = preg_replace('/\s+/', ' ', $x) ?: $x;
        return $x;
    }

    private function existe(\PDO $pdo, string $tabla, string $id): bool
    {
        $st = $pdo->prepare("SELECT id FROM {$tabla} WHERE id = :id");
        $st->execute([':id' => $id]);
        return (bool)$st->fetch();
    }

    private function tecnicoIdParaUserId(string $userId): ?string
    {
        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id FROM tecnicos WHERE user_id = :u LIMIT 1');
        $st->execute([':u' => $userId]);
        $row = $st->fetch();
        return $row ? (string)$row['id'] : null;
    }

    private function isoToMysql(string $iso): string
    {
        $ts = strtotime($iso);
        if ($ts === false) {
            return gmdate('Y-m-d H:i:s');
        }
        return gmdate('Y-m-d H:i:s', $ts);
    }

    private function mysqlToIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string)$value . ' UTC');
        if ($ts === false) {
            return null;
        }
        return gmdate('Y-m-d\TH:i:s\Z', $ts);
    }
}
