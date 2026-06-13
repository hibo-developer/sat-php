# Checklist de seguridad en operación

## Comprobaciones semanales

- Verificar `https://www.hibo.software/api/health` y confirmar `200` con `{"ok":true}`.
- Verificar `https://www.hibo.software/api/auth/me` sin sesión y confirmar respuesta controlada.
- Verificar `https://www.hibo.software/api/setup/create_admin.php` y confirmar `403`.
- Comprobar que CORS solo devuelve `Access-Control-Allow-Origin` para dominios legítimos.
- Revisar que no haya usuarios legítimos bloqueados por el rate limiter.

## Revisión de logs

- Revisar `access.log` en busca de picos de `401`, `403`, `429` y `500`.
- Revisar `error.log` para detectar errores PHP, warnings repetidos y fallos en bucle.
- Filtrar accesos a rutas sensibles: `/api/auth/login`, `/api/setup/create_admin.php`, `/api/storage/`.
- Buscar accesos automatizados a rutas como `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/phpmyadmin`.
- Identificar IPs con muchas peticiones en poco tiempo o patrones fuera de horario.

## Validación funcional por rol

- Entrar como `admin` y comprobar usuarios, vistas administrativas y operativa crítica.
- Entrar como `oficina` y confirmar acceso normal a catálogos y flujos de trabajo.
- Entrar como `tecnico` y confirmar que ve solo lo necesario y puede seguir gestionando partes.
- Si hay sospecha de acceso indebido, forzar cambio de contraseña en la cuenta afectada.

## Configuración a revisar

- Confirmar que `allowed_origins` contiene solo dominios legítimos.
- Confirmar que `setup_enabled` permanece en `false`.
- Revisar si los umbrales del rate limiting generan falsos positivos.
- Comprobar que el certificado HTTPS sigue vigente y sin alertas del navegador.

## Señales de alerta

- Muchas respuestas `429` desde una misma IP o sobre varias cuentas.
- Muchas respuestas `401` seguidas para varios correos o usuarios.
- Cualquier `500` nuevo tras un despliegue o cambio de configuración.
- Accesos a rutas extrañas o escaneos automáticos del servidor.
- Incrementos súbitos de tráfico sin motivo operativo conocido.

## Respuesta recomendada

1. Identificar IP, franja horaria, usuario afectado y ruta implicada.
2. Confirmar si se trata de abuso automatizado o de un usuario legítimo bloqueado.
3. Si es abuso claro, bloquear la IP o rango desde el panel del hosting si está disponible.
4. Cambiar la contraseña de la cuenta afectada si hay indicios de compromiso.
5. Verificar que `setup_enabled` sigue en `false` y que CORS sigue restringido.
6. Guardar evidencia del incidente y documentar la actuación realizada.

## Después de cada despliegue

- Comprobar `health`, `auth/me` y el bloqueo de `create_admin.php`.
- Validar CORS con un origen legítimo y con un origen no autorizado.
- Verificar login correcto y login fallido controlado.
- Revisar durante las horas siguientes si aparecen `500`, `429` inesperados o quejas de usuarios.
