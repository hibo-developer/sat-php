<?php
declare(strict_types=1);

header('Content-Type: text/html; charset=UTF-8');

$indexHtml = __DIR__ . DIRECTORY_SEPARATOR . 'index.html';
if (is_file($indexHtml)) {
  readfile($indexHtml);
  exit;
}

http_response_code(500);
echo 'Falta index.html';
