-- Migración: añadir columna informe_pdf_url a ordenes_trabajo
-- Permite guardar la URL del PDF generado al registrar un parte, 
-- de modo que el botón "Descargar informe" solo aparece cuando el PDF realmente existe.

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS informe_pdf_url text;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ordenes_trabajo'
  AND column_name = 'informe_pdf_url';
