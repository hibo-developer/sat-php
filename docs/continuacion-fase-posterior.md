# Continuacion De Mejoras Pendientes

## Criterio

Esta lista recoge las mejoras que quedan fuera del cierre minimo orientado a produccion real. Se priorizan por impacto funcional, riesgo operativo y capacidad de mejorar adopcion, control y escalabilidad en la siguiente fase.

## Backlog Recomendado

| ID | Mejora | Prioridad | Recursos estimados | Objetivo |
| --- | --- | --- | --- | --- |
| 1 | Enriquecer estados de carga y errores en ordenes y partes con indicadores de sincronizacion, ultima actualizacion y reintentos guiados. | Alta | 1-2 dias frontend | Reducir incertidumbre operativa en movil y acelerar verificacion en produccion. |
| 2 | Añadir validaciones funcionales automatizadas para flujos criticos: login, crear orden, cerrar parte, valorar orden finalizada y exportaciones. | Alta | 2-3 dias frontend + QA | Detectar regresiones antes de desplegar y aumentar confianza en cada release. |
| 3 | Completar auditoria de autorizacion por rol en todas las pantallas y endpoints restantes. | Alta | 2-4 dias backend + frontend | Limitar exposicion de datos y asegurar coherencia entre permisos reales y UI visible. |
| 4 | Mejorar trazabilidad operativa con logs estructurados de login, errores API, sincronizacion offline y acciones administrativas. | Alta | 2-3 dias backend + ops | Facilitar soporte, diagnostico de incidencias y seguimiento de seguridad en produccion. |
| 5 | Crear panel o vista de incidencias de sincronizacion offline con cola pendiente, conflictos y ultimo intento. | Media-Alta | 2-3 dias frontend + datos locales | Dar control a tecnicos y administracion sobre operaciones pendientes sin depender de soporte tecnico. |
| 6 | Optimizar chunks grandes restantes (`exceljs`, `jspdf`, analitica pesada) y revisar carga diferida adicional. | Media | 1-2 dias frontend | Mejorar tiempo de carga inicial y experiencia en dispositivos moviles con menor capacidad. |
| 7 | Refinar `ListaOrdenesView` y `ParteTrabajoView` con componentes visuales finales reutilizables y pruebas de interfaz. | Media | 2-3 dias frontend | Consolidar mantenibilidad y acelerar futuras ampliaciones sin volver a crecer de forma monolitica. |
| 8 | Incorporar filtros operativos avanzados en ordenes: rango de fechas, tecnico, cliente, prioridad y exportaciones filtradas. | Media | 2-4 dias backend + frontend | Mejorar explotacion real del producto para coordinacion, seguimiento y reporting. |
| 9 | Añadir cuadro de mando de produccion con KPIs mas fiables: SLA, tiempo medio real, backlog por tecnico y tendencia semanal. | Media | 3-5 dias backend + frontend | Convertir la aplicacion en herramienta de gestion y no solo de registro operativo. |
| 10 | Endurecer despliegue y observabilidad con checklist automatizable, validacion post-deploy y guia de rollback. | Media | 1-2 dias ops + documentacion | Reducir riesgo en subidas a hosting compartido y hacer repetible el proceso de puesta en produccion. |
| 11 | Resolver advertencias no bloqueantes del build (`app-config.js` y tamano de chunks) con una estrategia definitiva. | Media-Baja | 0.5-1 dia frontend | Dejar el pipeline mas limpio y predecible para siguientes iteraciones. |
| 12 | Preparar documentacion funcional de usuario para administracion, tecnicos y operativa diaria. | Baja | 1-2 dias documentacion + negocio | Facilitar adopcion, formacion interna y reduccion de errores de uso. |

## Orden De Ejecucion Sugerido

1. Validaciones automaticas de flujos criticos.
2. Auditoria de autorizacion y trazabilidad operativa.
3. Estados de sincronizacion y errores enriquecidos.
4. Filtros avanzados y cuadro de mando.
5. Rendimiento fino, refactor visual final y limpieza completa del build.

## Resultado Esperado De La Siguiente Fase

- Mayor fiabilidad en despliegues y cambios.
- Mejor visibilidad de incidencias reales en produccion.
- Menor riesgo de regresiones funcionales.
- Mejor experiencia operativa para tecnicos y administracion.
- Base mas solida para seguir ampliando el producto.
