export function normalizarNombreTecnico(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function deduplicarTecnicosParaSelector(tecnicos, tecnicoSeleccionadoId = '') {
  const seleccionActual = String(tecnicoSeleccionadoId || '');
  const mapaTecnicos = new Map();

  for (const tecnico of Array.isArray(tecnicos) ? tecnicos : []) {
    const tecnicoId = String(tecnico?.id || '');
    const clave = normalizarNombreTecnico(tecnico?.nombre) || `id:${tecnicoId}`;
    const existente = mapaTecnicos.get(clave);

    if (!existente) {
      mapaTecnicos.set(clave, tecnico);
      continue;
    }

    const existenteEsSeleccionActual = seleccionActual && String(existente?.id || '') === seleccionActual;
    const tecnicoEsSeleccionActual = seleccionActual && tecnicoId === seleccionActual;

    if (!existenteEsSeleccionActual && tecnicoEsSeleccionActual) {
      mapaTecnicos.set(clave, tecnico);
    }
  }

  return Array.from(mapaTecnicos.values());
}
