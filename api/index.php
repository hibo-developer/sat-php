<?php
declare(strict_types=1);

require __DIR__ . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'bootstrap.php';

use Sat\Api\Http;
use Sat\Api\Request;
use Sat\Api\Router;

$request = Request::fromGlobals();
$router = new Router();

$router->get('/health', [Sat\Api\Controllers\HealthController::class, 'health']);

$router->post('/auth/login', [Sat\Api\Controllers\AuthController::class, 'login']);
$router->post('/auth/logout', [Sat\Api\Controllers\AuthController::class, 'logout']);
$router->get('/auth/me', [Sat\Api\Controllers\AuthController::class, 'me']);
$router->post('/auth/password', [Sat\Api\Controllers\AuthController::class, 'changePassword']);

$router->get('/clientes', [Sat\Api\Controllers\ClientesController::class, 'index']);
$router->post('/clientes', [Sat\Api\Controllers\ClientesController::class, 'create']);
$router->put('/clientes/{id}', [Sat\Api\Controllers\ClientesController::class, 'update']);
$router->delete('/clientes/{id}', [Sat\Api\Controllers\ClientesController::class, 'delete']);

$router->get('/equipos', [Sat\Api\Controllers\EquiposController::class, 'index']);
$router->post('/equipos', [Sat\Api\Controllers\EquiposController::class, 'create']);
$router->put('/equipos/{id}', [Sat\Api\Controllers\EquiposController::class, 'update']);
$router->delete('/equipos/{id}', [Sat\Api\Controllers\EquiposController::class, 'delete']);

$router->get('/tecnicos', [Sat\Api\Controllers\TecnicosController::class, 'index']);
$router->post('/tecnicos', [Sat\Api\Controllers\TecnicosController::class, 'create']);
$router->put('/tecnicos/{id}', [Sat\Api\Controllers\TecnicosController::class, 'update']);
$router->delete('/tecnicos/{id}', [Sat\Api\Controllers\TecnicosController::class, 'delete']);

$router->get('/inventario/materiales', [Sat\Api\Controllers\InventarioController::class, 'listarMateriales']);
$router->post('/inventario/materiales', [Sat\Api\Controllers\InventarioController::class, 'crearMaterial']);
$router->put('/inventario/materiales/{id}', [Sat\Api\Controllers\InventarioController::class, 'actualizarMaterial']);
$router->delete('/inventario/materiales/{id}', [Sat\Api\Controllers\InventarioController::class, 'eliminarMaterial']);
$router->post('/inventario/materiales/{id}/regularizar', [Sat\Api\Controllers\InventarioController::class, 'regularizarStock']);
$router->get('/inventario/movimientos', [Sat\Api\Controllers\InventarioController::class, 'listarMovimientos']);

$router->get('/ordenes', [Sat\Api\Controllers\OrdenesController::class, 'index']);
$router->post('/ordenes', [Sat\Api\Controllers\OrdenesController::class, 'create']);
$router->put('/ordenes/{id}', [Sat\Api\Controllers\OrdenesController::class, 'update']);
$router->delete('/ordenes/{id}', [Sat\Api\Controllers\OrdenesController::class, 'delete']);
$router->post('/ordenes/{id}/finalizar', [Sat\Api\Controllers\OrdenesController::class, 'finalizar']);
$router->post('/ordenes/{id}/valoracion', [Sat\Api\Controllers\OrdenesController::class, 'valoracion']);
$router->post('/ordenes/{id}/editar-parte', [Sat\Api\Controllers\OrdenesController::class, 'editarParte']);
$router->post('/ordenes/{id}/informe', [Sat\Api\Controllers\OrdenesController::class, 'guardarInforme']);

$router->post('/gps', [Sat\Api\Controllers\GpsController::class, 'insert']);

$router->post('/admin-users', [Sat\Api\Controllers\AdminUsersController::class, 'handle']);

$router->post('/storage-signed-url', [Sat\Api\Controllers\StorageController::class, 'signedUrl']);
$router->get('/storage/{bucket}/{path:.*}', [Sat\Api\Controllers\StorageController::class, 'serve']);
$router->post('/storage/upload', [Sat\Api\Controllers\StorageController::class, 'upload']);

$router->post('/partes', [Sat\Api\Controllers\PartesController::class, 'create']);

try {
    $router->dispatch($request);
} catch (Throwable $e) {
    Http::json(['error' => 'Error interno.'], 500);
}
