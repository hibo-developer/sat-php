<?php
declare(strict_types=1);

namespace Sat\Api;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class LoginRateLimiter
{
    private const SCOPE_IP = 'ip';
    private const SCOPE_EMAIL = 'email';

    public function __construct(
        private readonly PDO $pdo,
    ) {}

    public function retryAfterSeconds(string $email, string $ip): int
    {
        $retryAfter = 0;
        foreach ($this->subjects($email, $ip) as [$scope, $identifier]) {
            if ($identifier === '') {
                continue;
            }
            $retryAfter = max($retryAfter, $this->retryAfterForSubject($scope, $identifier));
        }
        return $retryAfter;
    }

    public function registerFailure(string $email, string $ip): void
    {
        $now = $this->now();
        $this->pdo->beginTransaction();
        try {
            foreach ($this->subjects($email, $ip) as [$scope, $identifier]) {
                if ($identifier === '') {
                    continue;
                }
                $this->bumpSubject($scope, $identifier, $now);
            }
            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    public function clear(string $email, string $ip): void
    {
        $items = [];
        foreach ($this->subjects($email, $ip) as [$scope, $identifier]) {
            if ($identifier !== '') {
                $items[] = [$scope, $identifier];
            }
        }
        if ($items === []) {
            return;
        }

        $st = $this->pdo->prepare('DELETE FROM auth_login_rate_limits WHERE scope = :scope AND identifier = :identifier');
        foreach ($items as [$scope, $identifier]) {
            $st->execute([
                ':scope' => $scope,
                ':identifier' => $identifier,
            ]);
        }
    }

    private function bumpSubject(string $scope, string $identifier, DateTimeImmutable $now): void
    {
        $st = $this->pdo->prepare('SELECT scope, identifier, attempt_count, window_started_at, blocked_until FROM auth_login_rate_limits WHERE scope = :scope AND identifier = :identifier LIMIT 1 FOR UPDATE');
        $st->execute([
            ':scope' => $scope,
            ':identifier' => $identifier,
        ]);
        $row = $st->fetch();

        $windowSeconds = $this->windowSeconds();
        $blockSeconds = $this->blockSeconds();
        $maxAttempts = $this->maxAttempts($scope);
        $nowSql = $this->formatSqlDateTime($now);

        if (!$row) {
            $insert = $this->pdo->prepare('INSERT INTO auth_login_rate_limits (scope, identifier, attempt_count, window_started_at, last_attempt_at, blocked_until) VALUES (:scope, :identifier, 1, :window_started_at, :last_attempt_at, NULL)');
            $insert->execute([
                ':scope' => $scope,
                ':identifier' => $identifier,
                ':window_started_at' => $nowSql,
                ':last_attempt_at' => $nowSql,
            ]);
            return;
        }

        $windowStartedAt = $this->parseSqlDateTime((string)$row['window_started_at']);
        $blockedUntil = $this->parseOptionalSqlDateTime($row['blocked_until'] ?? null);
        $attemptCount = (int)($row['attempt_count'] ?? 0);

        if ($blockedUntil && $blockedUntil > $now) {
            $updateBlocked = $this->pdo->prepare('UPDATE auth_login_rate_limits SET last_attempt_at = :last_attempt_at WHERE scope = :scope AND identifier = :identifier');
            $updateBlocked->execute([
                ':last_attempt_at' => $nowSql,
                ':scope' => $scope,
                ':identifier' => $identifier,
            ]);
            return;
        }

        if (!$windowStartedAt || ($now->getTimestamp() - $windowStartedAt->getTimestamp()) >= $windowSeconds) {
            $attemptCount = 1;
            $windowStartedAt = $now;
            $blockedUntil = null;
        } else {
            $attemptCount++;
            if ($attemptCount >= $maxAttempts) {
                $blockedUntil = $now->add(new DateInterval('PT' . $blockSeconds . 'S'));
            }
        }

        $update = $this->pdo->prepare('UPDATE auth_login_rate_limits SET attempt_count = :attempt_count, window_started_at = :window_started_at, last_attempt_at = :last_attempt_at, blocked_until = :blocked_until WHERE scope = :scope AND identifier = :identifier');
        $update->execute([
            ':attempt_count' => $attemptCount,
            ':window_started_at' => $this->formatSqlDateTime($windowStartedAt),
            ':last_attempt_at' => $nowSql,
            ':blocked_until' => $blockedUntil ? $this->formatSqlDateTime($blockedUntil) : null,
            ':scope' => $scope,
            ':identifier' => $identifier,
        ]);
    }

    private function retryAfterForSubject(string $scope, string $identifier): int
    {
        $st = $this->pdo->prepare('SELECT blocked_until FROM auth_login_rate_limits WHERE scope = :scope AND identifier = :identifier LIMIT 1');
        $st->execute([
            ':scope' => $scope,
            ':identifier' => $identifier,
        ]);
        $row = $st->fetch();
        $blockedUntil = $this->parseOptionalSqlDateTime($row['blocked_until'] ?? null);
        if (!$blockedUntil) {
            return 0;
        }

        $remaining = $blockedUntil->getTimestamp() - $this->now()->getTimestamp();
        return max(0, $remaining);
    }

    private function subjects(string $email, string $ip): array
    {
        $normalizedEmail = strtolower(trim($email));
        $normalizedIp = $this->normalizeIp($ip);

        return [
            [self::SCOPE_EMAIL, $normalizedEmail],
            [self::SCOPE_IP, $normalizedIp],
        ];
    }

    private function normalizeIp(string $ip): string
    {
        $value = trim($ip);
        if ($value === '') {
            return '';
        }
        return filter_var($value, FILTER_VALIDATE_IP) ? $value : '';
    }

    private function maxAttempts(string $scope): int
    {
        if ($scope === self::SCOPE_EMAIL) {
            return max(1, (int)App::config('login_limit_email_attempts', 5));
        }

        return max(1, (int)App::config('login_limit_ip_attempts', 10));
    }

    private function windowSeconds(): int
    {
        return max(60, (int)App::config('login_limit_window_seconds', 900));
    }

    private function blockSeconds(): int
    {
        return max(60, (int)App::config('login_limit_block_seconds', 900));
    }

    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    private function formatSqlDateTime(DateTimeImmutable $dateTime): string
    {
        return $dateTime->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    private function parseSqlDateTime(string $value): ?DateTimeImmutable
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        return DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $trimmed, new DateTimeZone('UTC')) ?: null;
    }

    private function parseOptionalSqlDateTime(mixed $value): ?DateTimeImmutable
    {
        return is_string($value) ? $this->parseSqlDateTime($value) : null;
    }
}
