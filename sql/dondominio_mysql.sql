-- SAT COTEPA para DonDominio
-- MySQL 8.0+

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;

CREATE DATABASE IF NOT EXISTS sat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sat;

DROP TABLE IF EXISTS ordenes_trabajo_gps;
DROP TABLE IF EXISTS materiales_orden;
DROP TABLE IF EXISTS inventario_movimientos;
DROP TABLE IF EXISTS ordenes_trabajo;
DROP TABLE IF EXISTS inventario_materiales;
DROP TABLE IF EXISTS equipos;
DROP TABLE IF EXISTS tecnicos;
DROP TABLE IF EXISTS usuarios_sat;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS clientes;

CREATE TABLE usuarios (
  id CHAR(36) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(64) DEFAULT NULL,
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuarios_sat (
  user_id CHAR(36) NOT NULL,
  rol ENUM('admin', 'oficina', 'tecnico') NOT NULL,
  nombre_visible VARCHAR(190) DEFAULT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_usuarios_sat_user
    FOREIGN KEY (user_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clientes (
  id CHAR(36) NOT NULL,
  nombre VARCHAR(190) NOT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  telefono VARCHAR(60) DEFAULT NULL,
  email VARCHAR(190) DEFAULT NULL,
  lat DECIMAL(10, 7) DEFAULT NULL,
  lng DECIMAL(10, 7) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clientes_nombre (nombre),
  KEY idx_clientes_lat_lng (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tecnicos (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) DEFAULT NULL,
  nombre VARCHAR(190) NOT NULL,
  especialidad VARCHAR(190) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tecnicos_user_id (user_id),
  KEY idx_tecnicos_nombre (nombre),
  CONSTRAINT fk_tecnicos_user
    FOREIGN KEY (user_id) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE equipos (
  id CHAR(36) NOT NULL,
  cliente_id CHAR(36) NOT NULL,
  nombre VARCHAR(190) NOT NULL,
  marca VARCHAR(190) DEFAULT NULL,
  modelo VARCHAR(190) DEFAULT NULL,
  numero_serie VARCHAR(190) DEFAULT NULL,
  ultima_revision DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_equipos_cliente_id (cliente_id),
  KEY idx_equipos_nombre (nombre),
  CONSTRAINT fk_equipos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventario_materiales (
  id CHAR(36) NOT NULL,
  nombre VARCHAR(190) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  unidad VARCHAR(30) NOT NULL DEFAULT 'ud',
  stock_actual INT NOT NULL DEFAULT 0,
  precio_ref DECIMAL(10, 2) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventario_materiales_nombre (nombre),
  KEY idx_inventario_materiales_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ordenes_trabajo (
  id CHAR(36) NOT NULL,
  numero_ticket BIGINT NOT NULL AUTO_INCREMENT,
  cliente_id CHAR(36) NOT NULL,
  equipo_id CHAR(36) DEFAULT NULL,
  tecnico_id CHAR(36) NOT NULL,
  descripcion_averia TEXT NOT NULL,
  tareas_realizadas LONGTEXT DEFAULT NULL,
  tiempo_empleado_minutos INT DEFAULT NULL,
  mecanicos_intervinieron INT NOT NULL DEFAULT 1,
  estado ENUM('pendiente', 'en_proceso', 'pausado', 'finalizado') NOT NULL DEFAULT 'pendiente',
  prioridad ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
  foto_url VARCHAR(255) DEFAULT NULL,
  firma_url VARCHAR(255) DEFAULT NULL,
  informe_pdf_url VARCHAR(255) DEFAULT NULL,
  nombre_conformidad_cliente VARCHAR(190) DEFAULT NULL,
  referencia_informe VARCHAR(255) DEFAULT NULL,
  sin_intervencion TINYINT(1) NOT NULL DEFAULT 0,
  origen_parte_imprevista TINYINT(1) NOT NULL DEFAULT 0,
  fecha_inicio DATETIME DEFAULT NULL,
  fecha_fin DATETIME DEFAULT NULL,
  desplazamiento_inicio DATETIME DEFAULT NULL,
  desplazamiento_fin DATETIME DEFAULT NULL,
  desplazamiento_distancia_metros INT DEFAULT NULL,
  desplazamiento_distancia_factura_km DECIMAL(10, 2) DEFAULT NULL,
  intervension_inicio DATETIME DEFAULT NULL,
  intervension_fin DATETIME DEFAULT NULL,
  intervension_distancia_metros INT DEFAULT NULL,
  intervension_geo_inicio TEXT DEFAULT NULL,
  intervension_geo_fin TEXT DEFAULT NULL,
  localizacion_inicio VARCHAR(255) DEFAULT NULL,
  localizacion_fin VARCHAR(255) DEFAULT NULL,
  desplazamiento_lugar_inicio TEXT DEFAULT NULL,
  desplazamiento_lugar_fin TEXT DEFAULT NULL,
  intervension_lugar_inicio TEXT DEFAULT NULL,
  intervension_lugar_fin TEXT DEFAULT NULL,
  coste_materiales_editable DECIMAL(10, 2) DEFAULT NULL,
  tarifa_mano_obra_hora DECIMAL(10, 2) DEFAULT NULL,
  horas_mano_obra DECIMAL(10, 2) DEFAULT NULL,
  tarifa_desplazamiento_km DECIMAL(10, 2) DEFAULT NULL,
  km_desplazamiento_facturables DECIMAL(10, 2) DEFAULT NULL,
  recargo_festivo_pct DECIMAL(10, 2) DEFAULT 25.00,
  recargo_fuera_horario_pct DECIMAL(10, 2) DEFAULT 20.00,
  aplica_recargo_festivo TINYINT(1) DEFAULT NULL,
  aplica_recargo_fuera_horario TINYINT(1) DEFAULT NULL,
  coste_mano_obra_total DECIMAL(10, 2) DEFAULT NULL,
  coste_desplazamiento_total DECIMAL(10, 2) DEFAULT NULL,
  coste_total DECIMAL(10, 2) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ordenes_trabajo_numero_ticket (numero_ticket),
  KEY idx_ordenes_trabajo_cliente_id (cliente_id),
  KEY idx_ordenes_trabajo_equipo_id (equipo_id),
  KEY idx_ordenes_trabajo_tecnico_id (tecnico_id),
  KEY idx_ordenes_trabajo_updated_at (updated_at),
  CONSTRAINT fk_ordenes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_ordenes_equipo
    FOREIGN KEY (equipo_id) REFERENCES equipos (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ordenes_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES tecnicos (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materiales_orden (
  id CHAR(36) NOT NULL,
  orden_id CHAR(36) NOT NULL,
  material_id CHAR(36) DEFAULT NULL,
  nombre_material VARCHAR(190) NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10, 2) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_materiales_orden_orden_id (orden_id),
  KEY idx_materiales_orden_material_id (material_id),
  CONSTRAINT fk_materiales_orden_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_materiales_orden_material
    FOREIGN KEY (material_id) REFERENCES inventario_materiales (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventario_movimientos (
  id CHAR(36) NOT NULL,
  material_id CHAR(36) NOT NULL,
  tipo_movimiento ENUM('alta', 'entrada', 'regularizacion', 'salida') NOT NULL,
  cantidad INT NOT NULL,
  stock_anterior INT NOT NULL,
  stock_nuevo INT NOT NULL,
  motivo VARCHAR(255) DEFAULT NULL,
  creado_por CHAR(36) DEFAULT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventario_movimientos_material (material_id),
  KEY idx_inventario_movimientos_fecha (creado_en),
  KEY idx_inventario_movimientos_creado_por (creado_por),
  CONSTRAINT fk_inventario_movimientos_material
    FOREIGN KEY (material_id) REFERENCES inventario_materiales (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inventario_movimientos_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ordenes_trabajo_gps (
  id CHAR(36) NOT NULL,
  orden_id CHAR(36) NOT NULL,
  tecnico_id CHAR(36) NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  accuracy_m DECIMAL(10, 2) DEFAULT NULL,
  recorded_at DATETIME NOT NULL,
  tipo VARCHAR(50) DEFAULT 'seguimiento',
  source VARCHAR(50) DEFAULT 'web',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ordenes_trabajo_gps_orden (orden_id),
  KEY idx_ordenes_trabajo_gps_recorded_at (recorded_at),
  CONSTRAINT fk_ordenes_trabajo_gps_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ordenes_trabajo_gps_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES tecnicos (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;
