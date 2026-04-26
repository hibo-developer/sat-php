-- Script de datos de prueba para SAT
-- Ejecutar en Supabase SQL Editor (Supabase local o remoto)
-- Inserta: 4 clientes, 7 equipos, 3 técnicos, 9 órdenes de trabajo

-- Limpiar datos anteriores (comentar si quieres preservar)
-- DELETE FROM materiales_orden;
-- DELETE FROM ordenes_trabajo;
-- DELETE FROM equipos;
-- DELETE FROM tecnicos;
-- DELETE FROM clientes;

-- ===== CLIENTES =====
INSERT INTO clientes (nombre, direccion, telefono, email) VALUES
('Panadería Don Juan', 'Calle Principal 123, Madrid', '912345678', 'contacto@donjuan.es'),
('Pastelería La Tradicional', 'Avenida España 456, Barcelona', '934567890', 'info@latradicional.com'),
('Horno Central COTEPA', 'Plaza Mayor 789, Valencia', '961234567', 'admin@hornocentral.es'),
('Fábrica de Pan María', 'Carretera Nacional km 25, Sevilla', '954123456', 'contacto@panmaria.es')
ON CONFLICT DO NOTHING;

-- ===== TÉCNICOS =====
INSERT INTO tecnicos (nombre, especialidad, activo) VALUES
('Carlos Martínez', 'Hornos de vapor', true),
('Ana García López', 'Sistemas de control', true),
('Juan Pérez Díaz', 'Mantenimiento general', true)
ON CONFLICT DO NOTHING;

-- ===== EQUIPOS =====
-- Para Don Juan
INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision) 
SELECT id, 'Horno de vapor industrial', 'COTEPA', 'HSV-200', 'SN-2023-001', '2026-03-15'
FROM clientes WHERE nombre = 'Panadería Don Juan'
ON CONFLICT DO NOTHING;

INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Formadora automática', 'Rheon', 'RM85', 'SN-2024-045', '2026-02-20'
FROM clientes WHERE nombre = 'Panadería Don Juan'
ON CONFLICT DO NOTHING;

-- Para La Tradicional
INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Horno de gas', 'Morello Forni', 'G60', 'SN-2022-089', '2026-01-10'
FROM clientes WHERE nombre = 'Pastelería La Tradicional'
ON CONFLICT DO NOTHING;

INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Armario fermentación', 'Prover', 'EF48.1', 'SN-2023-156', '2026-02-28'
FROM clientes WHERE nombre = 'Pastelería La Tradicional'
ON CONFLICT DO NOTHING;

-- Para Horno Central
INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Horno rotatorio', 'Sveba Dahle', 'R60', 'SN-2021-234', '2025-12-05'
FROM clientes WHERE nombre = 'Horno Central COTEPA'
ON CONFLICT DO NOTHING;

INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Divisora de masa', 'Fatosa', 'DZ60', 'SN-2024-102', '2026-03-10'
FROM clientes WHERE nombre = 'Horno Central COTEPA'
ON CONFLICT DO NOTHING;

-- Para Fábrica María
INSERT INTO equipos (cliente_id, nombre, marca, modelo, numero_serie, ultima_revision)
SELECT id, 'Horno de bandejas', 'COTEPA', 'HB-150', 'SN-2023-267', '2026-01-25'
FROM clientes WHERE nombre = 'Fábrica de Pan María'
ON CONFLICT DO NOTHING;

-- ===== ÓRDENES DE TRABAJO =====

-- Orden 1: Pendiente - Don Juan
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'El horno no mantiene temperatura. Revisar sensor y calibración del termostato.',
  'pendiente', 'alta',
  NOW() - INTERVAL '2 days'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Carlos Martínez'
WHERE c.nombre = 'Panadería Don Juan' AND e.nombre = 'Horno de vapor industrial'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 2: En Proceso - La Tradicional
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'Armario fermentación no enfría correctamente. Revisar compresor y refrigerante.',
  'en_proceso', 'media',
  NOW() - INTERVAL '1 day'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Ana García López'
WHERE c.nombre = 'Pastelería La Tradicional' AND e.nombre = 'Armario fermentación'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 3: Finalizado - Horno Central
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio, fecha_fin, tiempo_empleado_minutos, tareas_realizadas)
SELECT 
  c.id, e.id, t.id,
  'Revisión preventiva y mantenimiento del horno rotatorio.',
  'finalizado', 'baja',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days' + INTERVAL '3 hours',
  180,
  'Se cambió filtro de aire, se lubricó mecanismo rotatorio, se calibró temperatura. Equipo funcionando correctamente.'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Juan Pérez Díaz'
WHERE c.nombre = 'Horno Central COTEPA' AND e.nombre = 'Horno rotatorio'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 4: En Proceso - Don Juan (Formadora)
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'Formadora automática da error en módulo de control. Luz roja parpadea constantemente.',
  'en_proceso', 'urgente',
  NOW() - INTERVAL '4 hours'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Ana García López'
WHERE c.nombre = 'Panadería Don Juan' AND e.nombre = 'Formadora automática'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 5: Pausado - La Tradicional (Horno gas)
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'Horno de gas no enciende. Verificar quemador y válvula de gas.',
  'pausado', 'alta',
  NOW() - INTERVAL '3 days'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Carlos Martínez'
WHERE c.nombre = 'Pastelería La Tradicional' AND e.nombre = 'Horno de gas'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 6: Pendiente - Horno Central (Divisora)
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'Divisora de masa desalineada. Las porciones no son uniformes.',
  'pendiente', 'media',
  NOW() - INTERVAL '6 hours'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Juan Pérez Díaz'
WHERE c.nombre = 'Horno Central COTEPA' AND e.nombre = 'Divisora de masa'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 7: Finalizado - Fábrica María
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio, fecha_fin, tiempo_empleado_minutos, tareas_realizadas)
SELECT 
  c.id, e.id, t.id,
  'Cambio de correas de transmisión del horno de bandejas.',
  'finalizado', 'media',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days' + INTERVAL '2 hours 30 minutes',
  150,
  'Se desmontó horno, se reemplazaron 4 correas gastadas por nuevas. Se realizaron pruebas de funcionamiento. Todo correcto.'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Carlos Martínez'
WHERE c.nombre = 'Fábrica de Pan María' AND e.nombre = 'Horno de bandejas'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 8: En Proceso - Don Juan (revisión)
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, tecnico_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id, t.id,
  'Revisión de seguridad periódica y validación de certificación.',
  'en_proceso', 'baja',
  NOW() - INTERVAL '12 hours'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
JOIN tecnicos t ON t.nombre = 'Juan Pérez Díaz'
WHERE c.nombre = 'Panadería Don Juan' AND e.nombre = 'Horno de vapor industrial'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Orden 9: Pendiente - Horno Central (sin técnico asignado aún)
INSERT INTO ordenes_trabajo (cliente_id, equipo_id, descripcion_averia, estado, prioridad, fecha_inicio)
SELECT 
  c.id, e.id,
  'Instalación de nuevo módulo de control automático en horno rotatorio.',
  'pendiente', 'media',
  NOW() - INTERVAL '1 hour'
FROM clientes c
JOIN equipos e ON c.id = e.cliente_id
WHERE c.nombre = 'Horno Central COTEPA' AND e.nombre = 'Horno rotatorio'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ===== MATERIALES DE PRUEBA (opcionales) =====
INSERT INTO materiales_orden (orden_id, nombre_material, cantidad, precio_unitario)
SELECT o.id, 'Sensor de temperatura RTD', 1, 45.50
FROM ordenes_trabajo o
WHERE o.descripcion_averia LIKE '%sensor%' 
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO materiales_orden (orden_id, nombre_material, cantidad, precio_unitario)
SELECT o.id, 'Refrigerante R134a', 2, 22.00
FROM ordenes_trabajo o
WHERE o.descripcion_averia LIKE '%enfría%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Mostrar resumen de datos insertados
SELECT 
  (SELECT COUNT(*) FROM clientes) as total_clientes,
  (SELECT COUNT(*) FROM equipos) as total_equipos,
  (SELECT COUNT(*) FROM tecnicos) as total_tecnicos,
  (SELECT COUNT(*) FROM ordenes_trabajo) as total_ordenes,
  (SELECT COUNT(*) FROM materiales_orden) as total_materiales;
