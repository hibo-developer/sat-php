import { jsPDF } from 'jspdf';
import logoCotepaUrl from '../assets/cotepa.jpg';
import { obtenerClienteSupabase } from './supabaseClient';

let logoEmpresaDataUrlCache = null;
let logoEmpresaPromise = null;
let logoCabeceraActual = null;
const DIRECCION_FISCAL_COTEPA_INICIO = 'COTEPA S.L. - C/ Sequia de Rascanya 7, Pol. Ind. Paiporta, 46200 Valencia';
let informeMetaActual = {
  referenciaInforme: '',
  fechaInforme: '',
};

export function obtenerUrlPublicaInformeParte(clienteId, parteId) {
  const cliente = valorTexto(clienteId, '').trim();
  const parte = valorTexto(parteId, '').trim();

  if (!cliente || !parte) {
    return '';
  }

  const supabase = obtenerClienteSupabase();
  const ruta = `${cliente}/informe-parte-${parte}.pdf`;
  const { data } = supabase.storage.from('informes-partes').getPublicUrl(ruta);

  return data?.publicUrl || '';
}

function valorTexto(valor, fallback = 'N/D') {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto || fallback;
}

function formatearFecha(valor) {
  if (!valor) {
    return 'N/D';
  }

  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) {
    return String(valor);
  }

  return fecha.toLocaleString('es-ES');
}

  function resolverMinutosFase(fase) {
    const minutosGeo = Number(fase?.minutosGeo);
    if (Number.isFinite(minutosGeo) && minutosGeo > 0) {
      return Math.round(minutosGeo);
    }

    if (!fase?.inicioIso || !fase?.finIso) {
      return null;
    }

    const inicioMs = new Date(fase.inicioIso).getTime();
    const finMs = new Date(fase.finIso).getTime();
    const diff = finMs - inicioMs;
    if (!Number.isFinite(diff) || diff <= 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(diff / 60000));
  }

function formatearFechaOficial(valor) {
  if (!valor) {
    return 'N/D';
  }

  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) {
    return String(valor);
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

function crearReferenciaInforme(fechaIso, secuencial) {
  const fecha = new Date(fechaIso);
  const ahora = Number.isFinite(fecha.getTime()) ? fecha : new Date();
  const dd = String(ahora.getDate()).padStart(2, '0');
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const yyyy = ahora.getFullYear();
  const seq = String(Number.isFinite(secuencial) ? secuencial : 1).padStart(2, '0');
  return `SAT-${dd}-${mm}-${yyyy}/${seq}`;
}

function materialesDesdeTexto(texto) {
  if (!texto || !texto.trim()) {
    return [];
  }

  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const [nombre, cantidad, precio] = linea.split(';').map((v) => (v || '').trim());
      const cantidadNum = Number.parseInt(cantidad, 10);
      const precioUnitarioNum = Number.parseFloat((precio || '').replace(',', '.'));
      const importeNum = Number.isFinite(cantidadNum) && Number.isFinite(precioUnitarioNum)
        ? (cantidadNum * precioUnitarioNum)
        : null;

      return {
        nombre: nombre || 'Material',
        cantidad: cantidad || '1',
        importeNum,
        precio: Number.isFinite(importeNum) ? `${importeNum.toFixed(2)} EUR` : 'N/D',
      };
    });
}

const PDF_ESTILO = {
  colorPrimario: [15, 23, 42],
  colorSecundario: [203, 213, 225],
  colorAcento: [185, 28, 28],
  colorNaranja: [204, 72, 10],
  colorFondoPagina: [241, 245, 249],
  colorFondoCaja: [255, 255, 255],
  colorFranjaSuave: [248, 241, 242],
  colorTexto: [30, 41, 59],
  margenX: 15,
  anchoContenido: 180,
};

function iniciarPagina(doc, estado) {
  doc.setFillColor(...PDF_ESTILO.colorFondoPagina);
  doc.rect(8.3, 8.3, 193.4, 280.4, 'F');
  doc.setFillColor(...PDF_ESTILO.colorFranjaSuave);
  doc.rect(8.3, 8.3, 193.4, 4, 'F');
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, 194, 281);
  estado.y = 18;
}

function reservarEspacio(doc, estado, altoNecesario, withHeader = true) {
  if (estado.y + altoNecesario <= 284) {
    return;
  }

  doc.addPage();
  iniciarPagina(doc, estado);
  if (withHeader) {
    dibujarCabeceraSimple(doc, estado);
  }
}

function dibujarCabeceraSimple(doc, estado) {
  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, 16, 2.5, 2.5, 'FD');

  const logoX = PDF_ESTILO.margenX + 3;
  const logoY = estado.y + 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoX, logoY, 15, 12, 1.5, 1.5, 'F');
  if (logoCabeceraActual) {
    try {
      doc.addImage(logoCabeceraActual, 'JPEG', logoX + 0.8, logoY + 0.8, 13.4, 10.4);
    } catch {
      // Si falla el logo, mantenemos la cabecera funcional.
    }
  }

  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('INFORME SAT - CONTINUACION', PDF_ESTILO.margenX + 20, estado.y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Ref. ${valorTexto(informeMetaActual.referenciaInforme)}`, PDF_ESTILO.margenX + 20, estado.y + 12);
  doc.text(`Fecha ${valorTexto(informeMetaActual.fechaInforme)}`, PDF_ESTILO.margenX + 90, estado.y + 12);

  doc.setTextColor(...PDF_ESTILO.colorTexto);
  estado.y += 23;
}

function dibujarCabeceraPrincipal(doc, estado, referenciaInforme, logoEmpresaDataUrl) {
  const alturaCabecera = 36;
  doc.setFillColor(...PDF_ESTILO.colorPrimario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, alturaCabecera, 4, 4, 'F');

  // Logo cuadrado en la izquierda
  const logoX = PDF_ESTILO.margenX + 4;
  const logoY = estado.y + 7;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoX, logoY, 22, 22, 2, 2, 'F');
  if (logoEmpresaDataUrl) {
    try {
      doc.addImage(logoEmpresaDataUrl, 'JPEG', logoX + 1, logoY + 1, 20, 20);
    } catch {
      // Si falla la carga del logo, mantenemos la caja en blanco para no romper el PDF.
    }
  }

  // Badges en la derecha
  const badgeX = PDF_ESTILO.margenX + 141;
  const badgeAncho = 36;
  const badgeCentroX = badgeX + badgeAncho / 2;

  doc.setFillColor(...PDF_ESTILO.colorNaranja);
  doc.roundedRect(badgeX, estado.y + 3, badgeAncho, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PRIORIDAD', badgeCentroX, estado.y + 8, { align: 'center' });
  doc.setFontSize(11);
  doc.text(informeMetaActual.prioridad || 'N/D', badgeCentroX, estado.y + 15, { align: 'center' });

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(badgeX, estado.y + 20, badgeAncho, 13, 2, 2, 'F');
  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TIEMPO', badgeCentroX, estado.y + 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${informeMetaActual.tiempoMin || 'N/D'} min`, badgeCentroX, estado.y + 31, { align: 'center' });

  // Titulo centrado en el espacio entre logo y badges
  const textoCentroX = (PDF_ESTILO.margenX + 30 + badgeX) / 2;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INFORME DE PARTE DE TRABAJO', textoCentroX, estado.y + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('SAT COTEPA - Servicio Tecnico Oficial', textoCentroX, estado.y + 20, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Ref.: ${valorTexto(referenciaInforme)}`, textoCentroX, estado.y + 27, { align: 'center' });

  doc.setTextColor(...PDF_ESTILO.colorTexto);
  estado.y += alturaCabecera + 5;
}

function dibujarTarjetaResumen(doc, x, y, ancho, alto, titulo, valor) {
  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'FD');

  doc.setFillColor(...PDF_ESTILO.colorFranjaSuave);
  doc.roundedRect(x + 1, y + 1, ancho - 2, 7, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_ESTILO.colorAcento);
  doc.text(titulo.toUpperCase(), x + 2.5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_ESTILO.colorTexto);
  const lineas = doc.splitTextToSize(valorTexto(valor), ancho - 5);
  doc.text(lineas.slice(0, 2), x + 2.5, y + 13);
}

function dibujarResumenTarjetas(doc, estado, datos) {
  const cols = 3;
  const gap = 4;
  const anchoTarjeta = (PDF_ESTILO.anchoContenido - (gap * (cols - 1))) / cols;
  const altoTarjeta = 20;
  const filas = Math.ceil(datos.length / cols);
  const altoTotal = filas * altoTarjeta + ((filas - 1) * 2) + 2;
  reservarEspacio(doc, estado, altoTotal);

  for (let i = 0; i < datos.length; i += 1) {
    const col = i % cols;
    const fila = Math.floor(i / cols);
    const x = PDF_ESTILO.margenX + (col * (anchoTarjeta + gap));
    const y = estado.y + (fila * (altoTarjeta + 2));
    const [titulo, valor] = datos[i];
    dibujarTarjetaResumen(doc, x, y, anchoTarjeta, altoTarjeta, titulo, valor);
  }

  estado.y += altoTotal + 3;
}

function dibujarBloqueDatos(doc, estado, datos) {
  const xEtiqueta = PDF_ESTILO.margenX + 4;
  const xValor = PDF_ESTILO.margenX + 70;
  const anchoValor = PDF_ESTILO.anchoContenido - (xValor - PDF_ESTILO.margenX) - 4;

  const filas = datos.map(([etiqueta, valor]) => {
    const lineasValor = doc.splitTextToSize(valorTexto(valor), anchoValor);
    const altoFila = Math.max(7, lineasValor.length * 4.2 + 2);
    return { etiqueta, lineasValor, altoFila };
  });

  const alto = filas.reduce((ac, fila) => ac + fila.altoFila, 0) + 6;
  reservarEspacio(doc, estado, alto);

  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, alto, 2, 2, 'FD');

  let y = estado.y + 7;
  filas.forEach(({ etiqueta, lineasValor, altoFila }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_ESTILO.colorPrimario);
    doc.text(`${etiqueta}:`, xEtiqueta, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_ESTILO.colorTexto);
    doc.text(lineasValor, xValor, y);
    y += altoFila;
  });

  estado.y += alto + 5;
}

function dibujarBloqueDatosDosColumnas(doc, estado, datos) {
  const columnas = 2;
  const padding = 4;
  const separacionColumnas = 6;
  const anchoColumna = (PDF_ESTILO.anchoContenido - (padding * 2) - separacionColumnas) / columnas;

  const datosColumna1 = [];
  const datosColumna2 = [];
  datos.forEach((item, indice) => {
    if (indice % 2 === 0) {
      datosColumna1.push(item);
    } else {
      datosColumna2.push(item);
    }
  });

  function medirAlturaColumna(items) {
    return items.reduce((altoAcumulado, [etiqueta, valor]) => {
      const textoLinea = `${etiqueta}: ${valorTexto(valor)}`;
      const lineas = doc.splitTextToSize(textoLinea, anchoColumna - 2);
      return altoAcumulado + (lineas.length * 4.2) + 2;
    }, 0);
  }

  const altoCol1 = medirAlturaColumna(datosColumna1);
  const altoCol2 = medirAlturaColumna(datosColumna2);
  const alto = Math.max(altoCol1, altoCol2) + 6;

  reservarEspacio(doc, estado, alto);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, alto, 2, 2, 'FD');

  const xCol1 = PDF_ESTILO.margenX + padding;
  const xCol2 = xCol1 + anchoColumna + separacionColumnas;
  let yCol1 = estado.y + 6;
  let yCol2 = estado.y + 6;

  doc.setFontSize(9);
  doc.setTextColor(...PDF_ESTILO.colorTexto);

  datosColumna1.forEach(([etiqueta, valor]) => {
    const textoLinea = `${etiqueta}: ${valorTexto(valor)}`;
    const lineas = doc.splitTextToSize(textoLinea, anchoColumna - 2);
    doc.setFont('helvetica', 'bold');
    doc.text(lineas[0] || '', xCol1, yCol1);
    if (lineas.length > 1) {
      doc.setFont('helvetica', 'normal');
      doc.text(lineas.slice(1), xCol1, yCol1 + 4.2);
    }
    yCol1 += (lineas.length * 4.2) + 2;
  });

  datosColumna2.forEach(([etiqueta, valor]) => {
    const textoLinea = `${etiqueta}: ${valorTexto(valor)}`;
    const lineas = doc.splitTextToSize(textoLinea, anchoColumna - 2);
    doc.setFont('helvetica', 'bold');
    doc.text(lineas[0] || '', xCol2, yCol2);
    if (lineas.length > 1) {
      doc.setFont('helvetica', 'normal');
      doc.text(lineas.slice(1), xCol2, yCol2 + 4.2);
    }
    yCol2 += (lineas.length * 4.2) + 2;
  });

  estado.y += alto + 5;
}

function dibujarTituloSeccion(doc, estado, titulo) {
  reservarEspacio(doc, estado, 12);
  doc.setFillColor(...PDF_ESTILO.colorAcento);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, 3, 8, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.text(titulo, PDF_ESTILO.margenX + 7, estado.y + 6);

  doc.setTextColor(...PDF_ESTILO.colorTexto);
  estado.y += 9;
}

function dibujarParrafo(doc, estado, texto) {
  const contenido = valorTexto(texto);
  const lineas = doc.splitTextToSize(contenido, PDF_ESTILO.anchoContenido - 8);
  const alto = lineas.length * 5 + 8;
  reservarEspacio(doc, estado, alto);

  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, alto, 2, 2, 'FD');

  doc.setFillColor(...PDF_ESTILO.colorFranjaSuave);
  doc.roundedRect(PDF_ESTILO.margenX + 1, estado.y + 1, PDF_ESTILO.anchoContenido - 2, 4, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_ESTILO.colorTexto);
  doc.text(lineas, PDF_ESTILO.margenX + 4, estado.y + 6);
  estado.y += alto + 3;
}

function dibujarTablaMateriales(doc, estado, materiales) {
  if (!materiales.length) {
    dibujarParrafo(doc, estado, 'Sin materiales declarados.');
    return;
  }

  const altoCabecera = 8;
  const altoFila = 7;
  const altoTotales = 8;
  const altoTabla = altoCabecera + materiales.length * altoFila + altoTotales;
  reservarEspacio(doc, estado, altoTabla + 6);

  const x = PDF_ESTILO.margenX;
  const colNombre = 110;
  const colCantidad = 30;
  const colPrecio = 40;

  doc.setFillColor(...PDF_ESTILO.colorPrimario);
  doc.rect(x, estado.y, PDF_ESTILO.anchoContenido, altoCabecera, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Material', x + 3, estado.y + 5.5);
  doc.text('Cantidad', x + colNombre + 3, estado.y + 5.5);
  doc.text('Importe', x + colNombre + colCantidad + 3, estado.y + 5.5);

  let y = estado.y + altoCabecera;
  materiales.forEach((material, indice) => {
    doc.setFillColor(indice % 2 === 0 ? 248 : 241, indice % 2 === 0 ? 250 : 245, indice % 2 === 0 ? 252 : 249);
    doc.rect(x, y, PDF_ESTILO.anchoContenido, altoFila, 'F');
    doc.setDrawColor(...PDF_ESTILO.colorSecundario);
    doc.rect(x, y, PDF_ESTILO.anchoContenido, altoFila);

    doc.setTextColor(...PDF_ESTILO.colorTexto);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const nombre = doc.splitTextToSize(material.nombre, colNombre - 5)[0] || 'Material';
    doc.text(nombre, x + 3, y + 4.8);
    doc.text(valorTexto(material.cantidad), x + colNombre + 3, y + 4.8);
    doc.text(valorTexto(material.precio), x + colNombre + colCantidad + 3, y + 4.8);

    y += altoFila;
  });

  const totalMateriales = materiales.reduce((acumulado, material) => {
    return acumulado + (Number.isFinite(Number(material.importeNum)) ? Number(material.importeNum) : 0);
  }, 0);

  doc.setFillColor(226, 232, 240);
  doc.rect(x, y, PDF_ESTILO.anchoContenido, altoTotales, 'F');
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.rect(x, y, PDF_ESTILO.anchoContenido, altoTotales);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.text('Total materiales', x + 3, y + 5.5);
  doc.text(`${totalMateriales.toFixed(2)} EUR`, x + colNombre + colCantidad + 3, y + 5.5);

  estado.y += altoTabla + 4;
}

async function dibujarFotos(doc, estado, fotosIntervencionUrls) {
  if (!Array.isArray(fotosIntervencionUrls) || fotosIntervencionUrls.length === 0) {
    dibujarParrafo(doc, estado, 'Sin fotos adjuntas.');
    return;
  }

  const anchoCaja = 87;
  const altoCaja = 62;
  const maxAnchoImg = 79;
  const maxAltoImg = 44;
  const columnas = 2;

  for (let i = 0; i < fotosIntervencionUrls.length; i += columnas) {
    reservarEspacio(doc, estado, altoCaja + 4);

    for (let col = 0; col < columnas; col += 1) {
      const indice = i + col;
      if (!fotosIntervencionUrls[indice]) continue;

      const x = PDF_ESTILO.margenX + col * (anchoCaja + 6);
      const y = estado.y;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...PDF_ESTILO.colorSecundario);
      doc.roundedRect(x, y, anchoCaja, altoCaja, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_ESTILO.colorPrimario);
      doc.text(`Foto ${indice + 1}`, x + 3, y + 6);

      const dataUrl = await urlADataUrl(fotosIntervencionUrls[indice]);
      if (!dataUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('No se pudo cargar la imagen.', x + 3, y + 15);
        continue;
      }

      // Ajustar imagen al marco sin deformar.
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          let ancho = maxAnchoImg;
          let alto = ancho / ratio;

          if (alto > maxAltoImg) {
            alto = maxAltoImg;
            ancho = alto * ratio;
          }

          const xImg = x + (anchoCaja - ancho) / 2;
          const yImg = y + 11 + (maxAltoImg - alto) / 2;
          doc.addImage(dataUrl, 'JPEG', xImg, yImg, ancho, alto);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }

    estado.y += altoCaja + 4;
  }
}

async function dibujarFirma(doc, estado, firmaUrl, nombreFirmante) {
  reservarEspacio(doc, estado, 58);
  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, 54, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.text('Firma del cliente', PDF_ESTILO.margenX + 4, estado.y + 8);

  if (firmaUrl) {
    const firmaDataUrl = await urlADataUrl(firmaUrl);
    if (firmaDataUrl) {
      doc.addImage(firmaDataUrl, 'PNG', PDF_ESTILO.margenX + 4, estado.y + 11, 85, 36);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('No se pudo cargar la firma.', PDF_ESTILO.margenX + 4, estado.y + 16);
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Sin firma registrada.', PDF_ESTILO.margenX + 4, estado.y + 16);
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(PDF_ESTILO.margenX + 110, estado.y + 41, PDF_ESTILO.margenX + 175, estado.y + 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_ESTILO.colorPrimario);
  doc.text(valorTexto(nombreFirmante), PDF_ESTILO.margenX + 111, estado.y + 38.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha del informe: ${valorTexto(informeMetaActual.fechaInforme)}`, PDF_ESTILO.margenX + 111, estado.y + 46);

  estado.y += 58;
}

function dibujarBloqueLegal(doc, estado) {
  reservarEspacio(doc, estado, 58);

  doc.setFillColor(...PDF_ESTILO.colorFondoCaja);
  doc.setDrawColor(...PDF_ESTILO.colorSecundario);
  doc.roundedRect(PDF_ESTILO.margenX, estado.y, PDF_ESTILO.anchoContenido, 54, 2, 2, 'FD');

  doc.setFillColor(...PDF_ESTILO.colorFranjaSuave);
  doc.roundedRect(PDF_ESTILO.margenX + 1, estado.y + 1, PDF_ESTILO.anchoContenido - 2, 7, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_ESTILO.colorAcento);
  doc.text('DATOS LEGALES Y DE EMISION', PDF_ESTILO.margenX + 2.5, estado.y + 6);

  const xIzq = PDF_ESTILO.margenX + 2.5;
  const xDer = PDF_ESTILO.margenX + 112;
  const yBase = estado.y + 12;

  doc.setTextColor(...PDF_ESTILO.colorTexto);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('COTEPA', xIzq, yBase);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.7);
  doc.text([
    'COTEPA SL (Sociedad Limitada)',
    'CIF/NIF: B46220042',
    'Direccion fiscal: C/ Sequia de Rascanya, 7, Pol.',
    'Ind., 46200 Paiporta (Valencia), Espana.',
    'Municipio/Provincia: Paiporta, Valencia',
    'Email SAT: sat@cotepa.com',
    'Web: http://www.cotepa.com',
  ], xIzq, yBase + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Validez del documento', xDer, yBase);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text([
    `Referencia: ${valorTexto(informeMetaActual.referenciaInforme)}`,
    `Fecha emision: ${valorTexto(informeMetaActual.fechaInforme)}`,
    'Generado desde SAT Movil',
    'COTEPA.',
    'Incluye evidencias fotograficas y',
    'firma.',
    'Uso interno y atencion al cliente.',
    'Copia no manipulable tras su',
    'emision.',
  ], xDer, yBase + 4.5);

  estado.y += 58;
}

function dibujarPiePaginas(doc) {
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...PDF_ESTILO.colorSecundario);
    doc.line(15, 281, 195, 281);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`SAT COTEPA - Web: http://www.cotepa.com - Pagina ${pagina}/${totalPaginas}`, 15, 284.5);
  }
}

function calcularHorasIntervencionMinimoUno(intervension) {
  const minutos = resolverMinutosFase(intervension);
  if (!Number.isFinite(Number(minutos)) || Number(minutos) <= 0) {
    return 1;
  }

  const horas = Number(minutos) / 60;
  return Math.max(1, Number(horas.toFixed(2)));
}

function construirResumenPausasComida(intervension) {
  const pausas = Array.isArray(intervension?.pausasComida) ? intervension.pausasComida : [];
  if (!pausas.length) {
    return {
      totalMinutos: 0,
      detalle: 'Sin pausas registradas',
    };
  }

  const totalMinutos = pausas.reduce((acumulado, pausa) => {
    const minutosPausa = resolverMinutosFase(pausa);
    return acumulado + (Number.isFinite(Number(minutosPausa)) ? Number(minutosPausa) : 0);
  }, 0);

  const detalle = pausas
    .map((pausa, indice) => {
      const inicio = formatearFecha(pausa?.inicioIso);
      const fin = formatearFecha(pausa?.finIso);
      const minutos = resolverMinutosFase(pausa);
      return `Pausa ${indice + 1}: ${inicio} -> ${fin} (${Number.isFinite(Number(minutos)) ? `${Math.round(Number(minutos))} min` : 'N/D'})`;
    })
    .join(' | ');

  return { totalMinutos, detalle };
}

function construirDatosControlTiempo({ seguimientoTiempo, desplazamiento, intervension }) {
  const hayDatosDesplazamiento = Boolean(desplazamiento?.inicioIso || desplazamiento?.finIso || desplazamiento?.distanciaMetros);
  const hayDatosIntervension = Boolean(intervension?.inicioIso || intervension?.finIso || intervension?.minutosGeo);
  const hayDatosSeguimiento = Boolean(seguimientoTiempo?.inicioIso || seguimientoTiempo?.finIso || seguimientoTiempo?.minutosGeo);

  if (!hayDatosDesplazamiento && !hayDatosIntervension && !hayDatosSeguimiento) {
    return null;
  }

  const inicioDesplazamiento = desplazamiento?.inicioIso || seguimientoTiempo?.inicioIso;
  const finDesplazamiento = desplazamiento?.finIso || seguimientoTiempo?.finIso;
  const lugarFinDesplazamiento = desplazamiento?.ubicacionFin?.nombreLugarCompleto
    || desplazamiento?.ubicacionFin?.nombreLugar
    || seguimientoTiempo?.ubicacionFin?.nombreLugarCompleto
    || seguimientoTiempo?.ubicacionFin?.nombreLugar;
  const distanciaMetros = Number.isFinite(Number(desplazamiento?.distanciaMetros))
    ? Math.round(Number(desplazamiento.distanciaMetros))
    : (Number.isFinite(Number(seguimientoTiempo?.distanciaMetros))
      ? Math.round(Number(seguimientoTiempo.distanciaMetros))
      : null);
  const kmDesplazamiento = Number.isFinite(Number(distanciaMetros))
    ? Number((Number(distanciaMetros) / 1000).toFixed(2))
    : null;

  const inicioIntervension = intervension?.inicioIso || seguimientoTiempo?.inicioIso;
  const finIntervension = intervension?.finIso || seguimientoTiempo?.finIso;
  const lugarIntervension = intervension?.ubicacionInicio?.nombreLugarCompleto
    || intervension?.ubicacionInicio?.nombreLugar
    || lugarFinDesplazamiento;
  const horasIntervension = calcularHorasIntervencionMinimoUno(intervension?.inicioIso ? intervension : seguimientoTiempo);
  const resumenPausas = construirResumenPausasComida(intervension);

  const filas = [];

  if (inicioDesplazamiento) filas.push(['Inicio desplazamiento', formatearFecha(inicioDesplazamiento)]);
  filas.push(['Lugar inicio', DIRECCION_FISCAL_COTEPA_INICIO]);
  if (finDesplazamiento) filas.push(['Fin desplazamiento', formatearFecha(finDesplazamiento)]);
  if (lugarFinDesplazamiento) filas.push(['Lugar fin desplazamiento', lugarFinDesplazamiento]);
  if (kmDesplazamiento !== null) filas.push(['Kilometraje (km)', String(kmDesplazamiento)]);

  if (inicioIntervension) filas.push(['Inicio intervencion', formatearFecha(inicioIntervension)]);
  if (finIntervension) filas.push(['Fin intervencion', formatearFecha(finIntervension)]);
  if (lugarIntervension) filas.push(['Lugar intervencion', lugarIntervension]);
  filas.push(['Tiempo intervencion (h)', String(horasIntervension)]);

  if (resumenPausas.totalMinutos > 0) {
    filas.push(['Pausas comida (min)', String(Math.round(resumenPausas.totalMinutos))]);
    filas.push(['Detalle pausas', resumenPausas.detalle]);
  }

  return filas;
}

async function urlADataUrl(url) {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    return await new Promise((resolve) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function obtenerLogoEmpresaDataUrl() {
  if (logoEmpresaDataUrlCache) {
    return logoEmpresaDataUrlCache;
  }

  if (!logoEmpresaPromise) {
    logoEmpresaPromise = urlADataUrl(logoCotepaUrl)
      .then((dataUrl) => {
        logoEmpresaDataUrlCache = dataUrl || null;
        return logoEmpresaDataUrlCache;
      })
      .finally(() => {
        logoEmpresaPromise = null;
      });
  }

  return logoEmpresaPromise;
}

async function crearPdfInforme({
  parte,
  formulario,
  seguimientoTiempo,
  desplazamiento,
  intervension,
  valoracionEconomica,
  clienteNombre,
  equipoNombre,
  tecnicoNombre,
  nombreFirmante,
  firmaUrl,
  fotosIntervencionUrls,
  secuencialDiario,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const estado = { y: 18 };
  const materiales = materialesDesdeTexto(formulario.materialesTexto);
  const fechaInformeIso = new Date().toISOString();
  const prioridadInforme = valorTexto(parte?.prioridad || formulario?.prioridad, 'N/D').toUpperCase();
  const tiempoMinInforme = valorTexto(
    parte?.tiempo_empleado_minutos !== undefined && parte?.tiempo_empleado_minutos !== null
      ? String(parte.tiempo_empleado_minutos)
      : String(formulario?.tiempo_empleado),
    'N/D',
  );
  const descripcionProblemaInforme = parte?.descripcion_averia || formulario?.descripcion_problema || '';
  const referenciaInforme = crearReferenciaInforme(fechaInformeIso, secuencialDiario);
  const logoEmpresaDataUrl = await obtenerLogoEmpresaDataUrl();
  logoCabeceraActual = logoEmpresaDataUrl;
  informeMetaActual = {
    referenciaInforme,
    fechaInforme: formatearFechaOficial(fechaInformeIso),
    prioridad: prioridadInforme,
    tiempoMin: tiempoMinInforme,
  };

  iniciarPagina(doc, estado);
  dibujarCabeceraPrincipal(doc, estado, referenciaInforme, logoEmpresaDataUrl);

  dibujarResumenTarjetas(doc, estado, [
    ['CLIENTE', clienteNombre],
    ['EQUIPO', equipoNombre],
    ['TECNICO', tecnicoNombre],
    ['N INFORME', referenciaInforme],
    ['FECHA', formatearFechaOficial(fechaInformeIso)],
    ['PRIORIDAD', prioridadInforme],
  ]);

  dibujarTituloSeccion(doc, estado, 'Datos del parte');
  const datosParte = [
    ['Tiempo empleado (min)', tiempoMinInforme],
    ['Descripcion problema', descripcionProblemaInforme],
  ];
  if (parte?.tareas_realizadas) datosParte.push(['Trabajos realizados', parte.tareas_realizadas]);
  dibujarBloqueDatos(doc, estado, datosParte);

  dibujarTituloSeccion(doc, estado, 'Control de tiempos y geolocalizacion');
  const datosControl = construirDatosControlTiempo({ seguimientoTiempo, desplazamiento, intervension });
  if (datosControl) {
    dibujarBloqueDatos(doc, estado, datosControl);
  } else {
    dibujarParrafo(doc, estado, 'Sin datos de control de tiempos.');
  }

  dibujarTituloSeccion(doc, estado, 'Materiales utilizados');
  dibujarTablaMateriales(doc, estado, materiales);

  if (valoracionEconomica) {
    const aplicaRecargoFestivo = Boolean(valoracionEconomica.aplicaRecargoFestivo);
    const aplicaRecargoFueraHorario = Boolean(valoracionEconomica.aplicaRecargoFueraHorario);
    const recargoFestivoPctAplicado = aplicaRecargoFestivo
      ? Number(valoracionEconomica.recargoFestivoPct || 0)
      : 0;
    const recargoFueraHorarioPctAplicado = aplicaRecargoFueraHorario
      ? Number(valoracionEconomica.recargoFueraHorarioPct || 0)
      : 0;
    const porcentajeRecargoManoObra = Number.isFinite(Number(valoracionEconomica.porcentajeRecargoManoObra))
      ? Number(valoracionEconomica.porcentajeRecargoManoObra)
      : (recargoFestivoPctAplicado + recargoFueraHorarioPctAplicado);
    const costeManoObraBase = Number.isFinite(Number(valoracionEconomica.costeManoObraBase))
      ? Number(valoracionEconomica.costeManoObraBase)
      : Number(valoracionEconomica.tarifaManoObraHora || 0) * Number(valoracionEconomica.horasManoObra || 0);

    dibujarTituloSeccion(doc, estado, 'Valoracion economica');
    dibujarBloqueDatosDosColumnas(doc, estado, [
      ['Materiales (€)', Number.isFinite(Number(valoracionEconomica.costeMaterialesEditable)) ? `${Number(valoracionEconomica.costeMaterialesEditable).toFixed(2)} EUR` : 'N/D'],
      ['Tarifa mano de obra (€/h)', Number.isFinite(Number(valoracionEconomica.tarifaManoObraHora)) ? `${Number(valoracionEconomica.tarifaManoObraHora).toFixed(2)} EUR` : 'N/D'],
      ['Horas mano de obra', Number.isFinite(Number(valoracionEconomica.horasManoObra)) ? String(Number(valoracionEconomica.horasManoObra).toFixed(2)) : 'N/D'],
      ['Recargo festivo aplicado', aplicaRecargoFestivo ? 'Si' : 'No'],
      ['Recargo festivo (%)', `${recargoFestivoPctAplicado.toFixed(2)} %`],
      ['Recargo fuera horario aplicado', aplicaRecargoFueraHorario ? 'Si' : 'No'],
      ['Recargo fuera horario (%)', `${recargoFueraHorarioPctAplicado.toFixed(2)} %`],
      ['Mano de obra base (€)', `${costeManoObraBase.toFixed(2)} EUR`],
      ['Recargo total mano de obra (%)', `${porcentajeRecargoManoObra.toFixed(2)} %`],
      ['Coste mano de obra (€)', Number.isFinite(Number(valoracionEconomica.costeManoObraTotal)) ? `${Number(valoracionEconomica.costeManoObraTotal).toFixed(2)} EUR` : 'N/D'],
      ['Precio kilometraje (€/km)', Number.isFinite(Number(valoracionEconomica.tarifaDesplazamientoKm)) ? `${Number(valoracionEconomica.tarifaDesplazamientoKm).toFixed(2)} EUR` : 'N/D'],
      ['Km facturables', Number.isFinite(Number(valoracionEconomica.kmDesplazamientoFacturables)) ? String(Number(valoracionEconomica.kmDesplazamientoFacturables).toFixed(2)) : 'N/D'],
      ['Coste desplazamiento (€)', Number.isFinite(Number(valoracionEconomica.costeDesplazamientoTotal)) ? `${Number(valoracionEconomica.costeDesplazamientoTotal).toFixed(2)} EUR` : 'N/D'],
      ['TOTAL (€)', Number.isFinite(Number(valoracionEconomica.costeTotal)) ? `${Number(valoracionEconomica.costeTotal).toFixed(2)} EUR` : 'N/D'],
    ]);
  }

  dibujarTituloSeccion(doc, estado, 'Evidencias fotograficas');
  await dibujarFotos(doc, estado, fotosIntervencionUrls);

  dibujarTituloSeccion(doc, estado, 'Datos de emision y bloque legal');
  dibujarBloqueLegal(doc, estado);

  dibujarTituloSeccion(doc, estado, 'Conformidad');
  await dibujarFirma(doc, estado, firmaUrl, nombreFirmante);

  dibujarPiePaginas(doc);

  const referenciaSegura = referenciaInforme.replace(/\//g, '-').replace(/[^a-zA-Z0-9\-_]/g, '');
  const nombreArchivo = `${referenciaSegura}.pdf`;
  const pdfBlob = doc.output('blob');

  return { pdfBlob, nombreArchivo };
}

async function subirPdfInforme({ pdfBlob, nombreArchivo, clienteId }) {
  const supabase = obtenerClienteSupabase();
  const ruta = `${clienteId}/${nombreArchivo}`;

  const { error: errorSubida } = await supabase.storage
    .from('informes-partes')
    .upload(ruta, pdfBlob, {
      upsert: true,
      contentType: 'application/pdf',
      cacheControl: '3600',
    });

  if (errorSubida) {
    throw new Error(
      `No se pudo subir el PDF a Storage. Verifica bucket/policies de informes-partes. (${errorSubida.message})`,
    );
  }

  const { data } = supabase.storage.from('informes-partes').getPublicUrl(ruta);
  return data?.publicUrl || null;
}

async function obtenerSecuencialDiario() {
  try {
    const supabase = obtenerClienteSupabase();
    const hoy = new Date();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
    const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString();

    const { count } = await supabase
      .from('ordenes_trabajo')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'finalizado')
      .gte('fecha_fin', inicioDia)
      .lt('fecha_fin', finDia);

    return (count || 0) + 1;
  } catch {
    return 1;
  }
}

export async function generarYSubirInformeParte({
  parte,
  formulario,
  seguimientoTiempo,
  desplazamiento,
  intervension,
  valoracionEconomica,
  clienteNombre,
  equipoNombre,
  tecnicoNombre,
  nombreFirmante,
  firmaUrl,
  fotosIntervencionUrls,
}) {
  const secuencialDiario = await obtenerSecuencialDiario();

  const { pdfBlob, nombreArchivo } = await crearPdfInforme({
    parte,
    formulario,
    seguimientoTiempo,
    desplazamiento,
    intervension,
    valoracionEconomica,
    clienteNombre,
    equipoNombre,
    tecnicoNombre,
    nombreFirmante,
    firmaUrl,
    fotosIntervencionUrls,
    secuencialDiario,
  });

  const pdfUrl = await subirPdfInforme({
    pdfBlob,
    nombreArchivo,
    clienteId: formulario.cliente_id,
  });

  if (!pdfUrl) {
    throw new Error('No se pudo obtener la URL pública del informe PDF.');
  }

  return { pdfUrl, nombreArchivo };
}

export async function generarInformeParteDemoLocal() {
  const ahoraIso = new Date().toISOString();
  const secuencialDiario = await obtenerSecuencialDiario();

  const { pdfBlob, nombreArchivo } = await crearPdfInforme({
    parte: { id: 'demo-local' },
    formulario: {
      cliente_id: 'demo-cliente',
      prioridad: 'alta',
      tiempo_empleado: '90',
      descripcion_problema: 'No alcanza temperatura de consigna.',
      materialesTexto: 'Resistencia 220V;1;49.90\nKit limpieza horno;1;18.50',
    },
    seguimientoTiempo: {
      inicioIso: ahoraIso,
      finIso: ahoraIso,
      ubicacionInicio: { nombreLugar: 'Quart de les Valls | Comunidad Valenciana' },
      ubicacionFin: { nombreLugar: 'Quart de les Valls | Comunidad Valenciana' },
      distanciaMetros: 1,
      minutosGeo: 1,
    },
    desplazamiento: null,
    intervension: null,
    valoracionEconomica: null,
    clienteNombre: 'Demo SAT - Panaderia Centro',
    equipoNombre: 'Horno Convencional',
    tecnicoNombre: 'Demo SAT - Laura Gomez',
    nombreFirmante: 'Cliente demo',
    firmaUrl: '',
    fotosIntervencionUrls: [],
    secuencialDiario,
  });

  const url = URL.createObjectURL(pdfBlob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);

  return { nombreArchivo };
}

