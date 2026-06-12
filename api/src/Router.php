<?php
declare(strict_types=1);

namespace Sat\Api;

final class Router
{
    private array $routes = [];

    public function get(string $pattern, array $handler): void { $this->add('GET', $pattern, $handler); }
    public function post(string $pattern, array $handler): void { $this->add('POST', $pattern, $handler); }
    public function put(string $pattern, array $handler): void { $this->add('PUT', $pattern, $handler); }
    public function delete(string $pattern, array $handler): void { $this->add('DELETE', $pattern, $handler); }

    private function add(string $method, string $pattern, array $handler): void
    {
        $this->routes[] = [$method, $pattern, $handler];
    }

    public function dispatch(Request $request): void
    {
        $method = $request->method;
        $path = $request->path;

        foreach ($this->routes as [$m, $pattern, $handler]) {
            if ($m !== $method) {
                continue;
            }

            [$regex, $vars] = $this->compile($pattern);
            if (!preg_match($regex, $path, $matches)) {
                continue;
            }

            $params = [];
            foreach ($vars as $name) {
                $params[$name] = isset($matches[$name]) ? urldecode((string)$matches[$name]) : '';
            }

            [$class, $methodName] = $handler;
            $controller = new $class();
            $controller->$methodName($request, $params);
            return;
        }

        Http::json(['error' => 'No encontrado.'], 404);
    }

    private function compile(string $pattern): array
    {
        $vars = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]+))?\}#', static function (array $m) use (&$vars) {
            $vars[] = $m[1];
            $re = $m[2] ?? '[^/]+';
            return '(?P<' . $m[1] . '>' . $re . ')';
        }, $pattern);

        return ['#^' . $regex . '$#', $vars];
    }
}
