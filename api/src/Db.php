<?php
declare(strict_types=1);

namespace Sat\Api;

use PDO;

final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }

        $host = (string)App::config('host', 'localhost');
        $port = (int)App::config('port', 3306);
        $db = (string)App::config('database', 'sat');
        $charset = (string)App::config('charset', 'utf8mb4');
        $user = (string)App::config('username', 'root');
        $pass = (string)App::config('password', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset={$charset}";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        self::$pdo = $pdo;
        return $pdo;
    }
}
