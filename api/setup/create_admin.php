<?php
declare(strict_types=1);

require __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'bootstrap.php';

use Sat\Api\App;
use Sat\Api\Db;
use Sat\Api\Http;
use Sat\Api\Uuid;

$setupEnabled = (bool)App::config('setup_enabled', false);
$tokenEnv = (string)App::config('setup_token', '');
$tokenReq = $_SERVER['HTTP_X_SETUP_TOKEN'] ?? '';
if (!$setupEnabled) {
    Http::json(['error' => 'Setup deshabilitado.'], 403);
}

if ($tokenEnv === '' || $tokenReq === '' || !hash_equals($tokenEnv, $tokenReq)) {
    Http::json(['error' => 'No autorizado.'], 403);
}

$raw = file_get_contents('php://input');
$body = $raw !== '' ? json_decode($raw, true) : null;
if (!is_array($body)) {
    Http::json(['error' => 'JSON inválido.'], 400);
}

$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$nombreVisible = trim((string)($body['nombre_visible'] ?? ''));

if ($email === '' || $password === '') {
    Http::json(['error' => 'email y password son obligatorios.'], 400);
}
if (strlen($password) < 10 || !preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password)) {
    Http::json(['error' => 'Contraseña débil.'], 400);
}

$pdo = Db::pdo();
$st = $pdo->prepare('SELECT id FROM usuarios WHERE email = :e LIMIT 1');
$st->execute([':e' => $email]);
if ($st->fetch()) {
    Http::json(['error' => 'Ya existe un usuario con ese email.'], 400);
}

$userId = Uuid::v4();
$hash = password_hash($password, PASSWORD_DEFAULT);

$pdo->beginTransaction();
try {
    $st = $pdo->prepare('INSERT INTO usuarios (id, email, password_hash, activo) VALUES (:id, :e, :h, 1)');
    $st->execute([':id' => $userId, ':e' => $email, ':h' => $hash]);

    $st = $pdo->prepare('INSERT INTO usuarios_sat (user_id, rol, nombre_visible) VALUES (:id, :r, :n)');
    $st->execute([':id' => $userId, ':r' => 'admin', ':n' => ($nombreVisible !== '' ? $nombreVisible : null)]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    Http::json(['error' => 'No se pudo crear el admin.'], 500);
}

Http::json(['ok' => true, 'user_id' => $userId, 'email' => $email]);
