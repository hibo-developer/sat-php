import { obtenerUrlFirmadaStorage } from './backendClient';
import { resolverNombreDescargaInforme } from './informeNombre';

function columnaExcel(indice) {
  let n = indice;
  let resultado = '';

  while (n > 0) {
    const resto = (n - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    n = Math.floor((n - 1) / 26);
  }

  return resultado;
}

let excelJsPromise = null;
let jsZipPromise = null;

async function cargarExcelJS() {
  if (!excelJsPromise) {
    excelJsPromise = import('exceljs')
      .then((modulo) => modulo.default || modulo)
      .catch((error) => {
        excelJsPromise = null;
        throw error;
      });
  }
  return excelJsPromise;
}

async function cargarJSZip() {
  if (!jsZipPromise) {
    jsZipPromise = import('jszip')
      .then((modulo) => modulo.default || modulo)
      .catch((error) => {
        jsZipPromise = null;
        throw error;
      });
  }
  return jsZipPromise;
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

export async function exportarExcelProfesional({
  nombreArchivo,
  hojaNombre,
  titulo,
  subtitulo,
  columnas,
  filas,
  resumen = [],
}) {
  const ExcelJS = await cargarExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAT COTEPA';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(hojaNombre);
  const totalColumnas = columnas.length;
  const ultimaColumna = columnaExcel(totalColumnas);

  columnas.forEach((columna, indice) => {
    worksheet.getColumn(indice + 1).width = columna.width || 20;
  });

  worksheet.mergeCells(`A1:${ultimaColumna}1`);
  worksheet.getCell('A1').value = titulo;
  worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${ultimaColumna}2`);
  worksheet.getCell('A2').value = subtitulo;
  worksheet.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF334155' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 20;

  let filaActual = 4;
  if (resumen.length) {
    worksheet.getCell(`A${filaActual}`).value = 'Resumen';
    worksheet.getCell(`A${filaActual}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
    filaActual += 1;

    resumen.forEach(([etiqueta, valor]) => {
      worksheet.getCell(`A${filaActual}`).value = etiqueta;
      worksheet.getCell(`A${filaActual}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      worksheet.getCell(`B${filaActual}`).value = valor;
      worksheet.getCell(`B${filaActual}`).font = { size: 10, color: { argb: 'FF334155' } };
      filaActual += 1;
    });

    filaActual += 1;
  }

  const filaEncabezado = filaActual;
  columnas.forEach((columna, indice) => {
    const celda = worksheet.getCell(filaEncabezado, indice + 1);
    celda.value = columna.header;
    celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    celda.alignment = { vertical: 'middle', horizontal: 'left' };
    celda.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const filaDatosInicio = filaEncabezado + 1;
  const filasDatos = filas.length ? filas : [{ __sinDatos: 'Sin datos para los filtros actuales' }];

  filasDatos.forEach((fila, indiceFila) => {
    const numeroFila = filaDatosInicio + indiceFila;

    columnas.forEach((columna, indiceColumna) => {
      const celda = worksheet.getCell(numeroFila, indiceColumna + 1);
      celda.value = fila[columna.key] ?? '';
      celda.font = { size: 10, color: { argb: 'FF0F172A' } };
      celda.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: indiceFila % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      celda.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (columna.numFmt) {
        celda.numFmt = columna.numFmt;
      }
    });
  });

  worksheet.autoFilter = {
    from: { row: filaEncabezado, column: 1 },
    to: { row: filaEncabezado, column: totalColumnas },
  };

  worksheet.views = [{ state: 'frozen', ySplit: filaEncabezado }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  descargarBlob(blob, nombreArchivo);
}

export async function exportarInformesZip({
  informes,
  nombreArchivo,
}) {
  const JSZip = await cargarJSZip();
  const zip = new JSZip();
  let agregados = 0;

  for (const orden of informes) {
    try {
      const urlInforme = await obtenerUrlFirmadaStorage(orden.informePdfUrl, { expiresIn: 900 });
      if (!urlInforme) {
        continue;
      }
      const respuesta = await fetch(urlInforme, { credentials: 'include' });
      if (!respuesta.ok) {
        continue;
      }

      const blob = await respuesta.blob();
      const nombre = resolverNombreDescargaInforme(orden);
      zip.file(nombre, blob);
      agregados += 1;
    } catch {
      // Ignorar informes individuales con fallo y continuar con el resto.
    }
  }

  if (!agregados) {
    throw new Error('No se pudo descargar ningún informe PDF.');
  }

  const contenidoZip = await zip.generateAsync({ type: 'blob' });
  descargarBlob(contenidoZip, nombreArchivo);
  return { agregados };
}
