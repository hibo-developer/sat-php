# Seguridad operativa

## Rate limiting de login

La API aplica limitacion de intentos en `POST /api/auth/login` con persistencia en MySQL.

Valores por defecto:

- `SAT_LOGIN_LIMIT_IP_ATTEMPTS=10`
- `SAT_LOGIN_LIMIT_EMAIL_ATTEMPTS=5`
- `SAT_LOGIN_LIMIT_WINDOW_SECONDS=900`
- `SAT_LOGIN_LIMIT_BLOCK_SECONDS=900`

Comportamiento:

- Bloquea temporalmente por email cuando hay demasiados fallos consecutivos.
- Bloquea temporalmente por IP cuando una misma IP acumula demasiados fallos.
- Devuelve `429 Too Many Requests` y cabecera `Retry-After` cuando el bloqueo sigue activo.
- Borra el contador tras un login correcto.

## SQL para instalaciones existentes

Si la instalacion ya estaba desplegada antes de esta fase, importar:

```sql
sql/security_rate_limit.sql
```

## Checklist de logs

Revisar en el hosting, al menos una vez por semana:

- `access.log`
- `error.log`
- errores PHP
- errores MySQL si el panel los expone

Buscar especialmente:

- picos de `401`, `403`, `404`, `429` y `500`
- multiples `POST /api/auth/login` desde la misma IP
- intentos contra `/api/setup/create_admin.php`
- user agents anómalos o vacíos
- peticiones repetidas a rutas inexistentes
- ráfagas fuera del horario habitual

## Indicadores de posible ataque

- muchas respuestas `401` seguidas para varios correos
- muchas respuestas `429` desde una misma IP
- intentos de acceso con `Origin` no corporativo
- peticiones a `/wp-login.php`, `/xmlrpc.php`, `/phpmyadmin`, `.env`, etc.
- aumentos súbitos de tráfico sin campañas previstas

## Respuesta recomendada

1. Identificar IP, franja horaria y ruta afectada.
2. Confirmar si el patrón es automatizado o un usuario legítimo bloqueado.
3. Si es abuso claro, bloquear IP o rango desde el panel del hosting si está disponible.
4. Revisar si la cuenta afectada necesita cambio de contraseña.
5. Verificar que `SAT_SETUP_ENABLED` sigue en `false`.
6. Comprobar que `SAT_ALLOWED_ORIGINS` contiene solo dominios legítimos.
7. Documentar el incidente y conservar evidencias.

## Verificación manual rápida

Después de cada despliegue de seguridad:

1. `GET /api/auth/me` debe responder `200`.
2. `GET /api/setup/create_admin.php` debe responder `403` si `SAT_SETUP_ENABLED=false`.
3. `Origin: https://evil.example` no debe recibir `Access-Control-Allow-Origin`.
4. Tras varios fallos de login, la API debe devolver `429`.
