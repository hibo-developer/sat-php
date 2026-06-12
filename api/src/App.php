<?php
declare(strict_types=1);

namespace Sat\Api;

final class App
{
    private static array $config = [];

    public static function setConfig(array $config): void
    {
        self::$config = $config;
    }

    public static function config(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, self::$config) ? self::$config[$key] : $default;
    }
}
