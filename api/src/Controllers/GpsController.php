<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class GpsController
{
    public function insert(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $body = is_array($request->body) ? $request->body : [];

        $ordenId = trim((string)($body['orden_id'] ?? ''));
        $tecnicoId = trim((string)($body['tecnico_id'] ?? ''));
        $lat = $body['lat'] ?? null;
        $lng = $body['lng'] ?? null;
        $recordedAt = trim((string)($body['recorded_at'] ?? ''));
        if ($ordenId === '' || $tecnicoId === '' || $lat === null || $lng === null || $recordedAt === '') {
            Http::json(['error' => 'Payload GPS inválido.'], 400);
        }

        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT tecnico_id FROM ordenes_trabajo WHERE id = :id');
        $st->execute([':id' => $ordenId]);
        $orden = $st->fetch();
        if (!$orden) {
            Http::json(['error' => 'La orden indicada no existe.'], 404);
        }
        if (($u['rol'] ?? '') === 'tecnico') {
            $tecUser = $this->tecnicoIdParaUserId((string)$u['id']);
            if (!$tecUser || $tecUser !== (string)$orden['tecnico_id'] || $tecUser !== $tecnicoId) {
                Http::json(['error' => 'Acceso denegado.'], 403);
            }
        }

        $id = Uuid::v4();
        $st = $pdo->prepare('INSERT INTO ordenes_trabajo_gps (id, orden_id, tecnico_id, lat, lng, accuracy_m, recorded_at, tipo, source) VALUES (:id, :o, :t, :lat, :lng, :acc, :ra, :tipo, :src)');
        $st->execute([
            ':id' => $id,
            ':o' => $ordenId,
            ':t' => $tecnicoId,
            ':lat' => $lat,
            ':lng' => $lng,
            ':acc' => $body['accuracy_m'] ?? null,
            ':ra' => $this->isoToMysql($recordedAt),
            ':tipo' => $body['tipo'] ?? 'seguimiento',
            ':src' => $body['source'] ?? 'web',
        ]);

        $row = $pdo->prepare('SELECT id, orden_id, tecnico_id, lat, lng, accuracy_m, recorded_at, tipo, source, created_at FROM ordenes_trabajo_gps WHERE id = :id');
        $row->execute([':id' => $id]);
        Http::json($row->fetch() ?: null);
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
}

