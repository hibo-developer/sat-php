<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\App;
use Sat\Api\Auth;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Uuid;

final class StorageController
{
    private const BUCKETS = ['firmas-clientes', 'fotos-intervenciones', 'informes-partes'];

    public function signedUrl(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $body = is_array($request->body) ? $request->body : [];
        $bucket = trim((string)($body['bucket'] ?? ''));
        $path = trim((string)($body['path'] ?? ''));
        if ($bucket === '' || $path === '') {
            Http::json(['error' => 'bucket y path son obligatorios.'], 400);
        }
        if (!in_array($bucket, self::BUCKETS, true)) {
            Http::json(['error' => 'Bucket no permitido.'], 400);
        }
        if (str_starts_with($path, '/') || str_contains($path, '..')) {
            Http::json(['error' => 'Path inválido.'], 400);
        }
        if (($u['rol'] ?? '') === 'tecnico') {
            $tecnicoId = $this->tecnicoIdParaUserId((string)$u['id']);
            if (!$tecnicoId) {
                Http::json(['error' => 'Técnico no vinculado.'], 403);
            }
            $segments = array_values(array_filter(explode('/', $path), static fn($x) => $x !== ''));
            if (count($segments) < 2 || $segments[1] !== $tecnicoId) {
                Http::json(['error' => 'Acceso denegado al recurso.'], 403);
            }
        }

        $base = (string)App::config('base_url', '');
        if ($base === '') {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $base = $scheme . '://' . $host;
        }
        $url = rtrim($base, '/') . '/api/storage/' . rawurlencode($bucket) . '/' . $this->encodePath($path);
        Http::json(['url' => $url]);
    }

    public function serve(Request $request, array $params): void
    {
        Auth::requireLogin();
        $bucket = (string)($params['bucket'] ?? '');
        $path = (string)($params['path'] ?? '');
        if ($bucket === '' || $path === '') {
            http_response_code(404);
            exit;
        }
        if (!in_array($bucket, self::BUCKETS, true)) {
            http_response_code(404);
            exit;
        }
        if (str_contains($path, '..') || str_starts_with($path, '/')) {
            http_response_code(404);
            exit;
        }

        $u = Auth::user();
        $rol = $u ? (Auth::roleForUserId((string)$u['id']) ?: '') : '';
        if ($rol === 'tecnico') {
            $tecnicoId = $this->tecnicoIdParaUserId((string)$u['id']);
            $segments = array_values(array_filter(explode('/', $path), static fn($x) => $x !== ''));
            if (!$tecnicoId || count($segments) < 2 || $segments[1] !== $tecnicoId) {
                http_response_code(403);
                exit;
            }
        }

        $root = (string)App::config('storage_root');
        $file = $root . DIRECTORY_SEPARATOR . $bucket . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        if (!is_file($file)) {
            http_response_code(404);
            exit;
        }

        $mime = $this->mimeForFile($file);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string)filesize($file));
        readfile($file);
        exit;
    }

    public function upload(Request $request, array $params): void
    {
        Auth::requireCsrf($request);
        $u = Auth::requireRole(['admin', 'oficina', 'tecnico']);
        $bucket = trim((string)($_POST['bucket'] ?? ''));
        $pathPrefix = trim((string)($_POST['pathPrefix'] ?? ''));
        $archivo = $_FILES['file'] ?? null;

        if ($bucket === '' || !in_array($bucket, self::BUCKETS, true)) {
            Http::json(['error' => 'Bucket no permitido.'], 400);
        }
        if ($pathPrefix === '' || str_starts_with($pathPrefix, '/') || str_contains($pathPrefix, '..')) {
            Http::json(['error' => 'pathPrefix inválido.'], 400);
        }
        if (!is_array($archivo) || ($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Http::json(['error' => 'Fichero requerido.'], 400);
        }

        if (($u['rol'] ?? '') === 'tecnico') {
            $tecnicoId = $this->tecnicoIdParaUserId((string)$u['id']);
            $segments = array_values(array_filter(explode('/', $pathPrefix), static fn($x) => $x !== ''));
            if (!$tecnicoId || count($segments) < 2 || $segments[1] !== $tecnicoId) {
                Http::json(['error' => 'Acceso denegado al recurso.'], 403);
            }
        }

        $ext = $this->extensionFromUpload((string)($archivo['name'] ?? ''), (string)($archivo['type'] ?? ''));
        $name = (string)time() . '-' . substr(bin2hex(random_bytes(8)), 0, 12) . ($ext ? ('.' . $ext) : '');
        $relPath = rtrim($pathPrefix, '/') . '/' . $name;

        $root = (string)App::config('storage_root');
        $dest = $root . DIRECTORY_SEPARATOR . $bucket . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relPath);
        $dir = dirname($dest);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $tmp = (string)($archivo['tmp_name'] ?? '');
        if (!is_uploaded_file($tmp) || !move_uploaded_file($tmp, $dest)) {
            Http::json(['error' => 'No se pudo guardar el fichero.'], 500);
        }

        Http::json([
            'reference' => 'sb://' . $bucket . '/' . $relPath,
        ]);
    }

    private function mimeForFile(string $file): string
    {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        return match ($ext) {
            'pdf' => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }

    private function extensionFromUpload(string $name, string $mime): string
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true)) {
            return $ext === 'jpeg' ? 'jpg' : $ext;
        }
        $m = strtolower($mime);
        return match ($m) {
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => '',
        };
    }

    private function tecnicoIdParaUserId(string $userId): ?string
    {
        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT id FROM tecnicos WHERE user_id = :u LIMIT 1');
        $st->execute([':u' => $userId]);
        $row = $st->fetch();
        return $row ? (string)$row['id'] : null;
    }

    private function encodePath(string $path): string
    {
        $parts = array_map('rawurlencode', explode('/', $path));
        return implode('/', $parts);
    }
}

