function normalizarFecha(fecha) {
  const base = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isFinite(base.getTime()) ? base : new Date();
}

function basenameDesdeReferenciaStorage(referencia) {
  const texto = String(referencia || '').trim();
  if (!texto) return '';
  if (texto.startsWith('sb://')) {
    const partes = texto.split('/');
    return partes[partes.length - 1] || '';
  }
  try {
    const url = new URL(texto);
    const partes = url.pathname.split('/').filter(Boolean);
    return partes[partes.length - 1] || '';
  } catch {
    return '';
  }
}

export function formatearSecuencialInforme(secuencia) {
  const numero = Number.parseInt(String(secuencia ?? ''), 10);
  return String(Number.isFinite(numero) && numero > 0 ? numero : 1).padStart(2, '0');
}

export function formatearReferenciaInforme(fecha, secuencia) {
  const base = normalizarFecha(fecha);
  const yy = String(base.getFullYear()).slice(-2);
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `SAT-${yy}${mm}${dd}-${formatearSecuencialInforme(secuencia)}`;
}

export function formatearNombreInformePdf(referencia) {
  const limpia = String(referencia || '').trim();
  return limpia.toLowerCase().endsWith('.pdf') ? limpia : `${limpia}.pdf`;
}

export function resolverNombreDescargaInforme(orden) {
  const referencia = String(orden?.referenciaInforme || orden?.referencia_informe || '').trim();
  if (referencia) {
    return formatearNombreInformePdf(referencia);
  }

  const desdeStorage = basenameDesdeReferenciaStorage(orden?.informePdfUrl || orden?.informe_pdf_url || '');
  if (desdeStorage) {
    return desdeStorage;
  }

  return `informe-${orden?.numero_ticket || orden?.id || 'sat'}.pdf`;
}
