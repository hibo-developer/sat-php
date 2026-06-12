<?php
declare(strict_types=1);

namespace Sat\Api\Controllers;

use Sat\Api\Http;
use Sat\Api\Request;

final class HealthController
{
    public function health(Request $request, array $params): void
    {
        Http::json(['ok' => true]);
    }
}

