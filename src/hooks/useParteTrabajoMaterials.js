import {
  calcularMinutosPausasComida,
  parsearNumeroDecimal,
  redondearMinutos,
} from '../services/parteTrabajoViewUtils';

export function useParteTrabajoMaterials({
  cargando,
  desplazamiento,
  firmaClienteDataUrl,
  formulario,
  guardando,
  intervension,
  materialSeleccionadoCantidad,
  materialSeleccionadoId,
  materialesInventario,
  materialesSeleccionados,
  setError,
  setMaterialSeleccionadoCantidad,
  setMaterialesSeleccionados,
}) {
  function agregarMaterialInventario() {
    const materialId = materialSeleccionadoId;
    const cantidad = Number.parseInt(materialSeleccionadoCantidad, 10);

    if (!materialId) {
      setError('Selecciona un material de inventario para agregarlo al parte.');
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError('La cantidad del material debe ser mayor que cero.');
      return;
    }

    setError('');
    setMaterialesSeleccionados((prev) => {
      const existente = prev.find((item) => item.material_id === materialId);
      if (existente) {
        return prev.map((item) =>
          item.material_id === materialId ? { ...item, cantidad: item.cantidad + cantidad } : item,
        );
      }

      return [...prev, { material_id: materialId, cantidad }];
    });
    setMaterialSeleccionadoCantidad('1');
  }

  function quitarMaterialInventario(materialId) {
    setMaterialesSeleccionados((prev) => prev.filter((item) => item.material_id !== materialId));
  }

  function calcularTotalMaterialesPreview() {
    const totalInventario = materialesSeleccionados.reduce((acumulado, uso) => {
      const material = materialesInventario.find((item) => item.id === uso.material_id);
      const precioUnitario = parsearNumeroDecimal(material?.precio_ref);
      if (!Number.isFinite(precioUnitario)) {
        return acumulado;
      }

      return acumulado + (uso.cantidad * precioUnitario);
    }, 0);

    const totalManual = (formulario.materialesTexto || '')
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .reduce((acumulado, linea) => {
        const [, cantidadRaw, precioRaw] = linea.split(';').map((v) => (v || '').trim());
        const cantidad = Number.parseInt(cantidadRaw, 10);
        const precioUnitario = parsearNumeroDecimal(precioRaw);

        if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario)) {
          return acumulado;
        }

        return acumulado + (cantidad * precioUnitario);
      }, 0);

    return totalInventario + totalManual;
  }

  const totalMaterialesPreview = calcularTotalMaterialesPreview();
  const minutosDesplazamiento = (desplazamiento.inicioIso && desplazamiento.finIso)
    ? redondearMinutos(desplazamiento.inicioIso, desplazamiento.finIso)
    : null;
  const kmDesplazamiento = Number.isFinite(Number(desplazamiento.distanciaMetros))
    ? (Number(desplazamiento.distanciaMetros) / 1000).toFixed(2)
    : null;
  const minutosPausaComida = calcularMinutosPausasComida(intervension.pausasComida);
  const minutosIntervensionBrutos = (intervension.inicioIso && intervension.finIso)
    ? redondearMinutos(intervension.inicioIso, intervension.finIso)
    : null;
  const minutosIntervensionNetos = Number.isFinite(minutosIntervensionBrutos)
    ? Math.max(1, minutosIntervensionBrutos - minutosPausaComida)
    : null;
  const puedeEliminarParteIncompletoSinOrden = !formulario.orden_id
    && Boolean(intervension.inicioIso && intervension.finIso)
    && (
      !desplazamiento.inicioIso
      || !desplazamiento.finIso
      || !firmaClienteDataUrl
      || !(formulario.nombre_firmante || '').trim()
      || !formulario.tecnico_id
      || (formulario.descripcion_problema || '').trim().length < 8
      || (!formulario.cliente_id && !(formulario.cliente_nombre || '').trim())
    );
  const puedeRegistrarParte = !guardando
    && !cargando
    && !!desplazamiento.inicioIso
    && !!desplazamiento.finIso
    && !!intervension.inicioIso
    && !!intervension.finIso
    && !intervension.pausaComidaActiva?.inicioIso
    && !!firmaClienteDataUrl
    && !!(formulario.nombre_firmante || '').trim();

  return {
    agregarMaterialInventario,
    kmDesplazamiento,
    minutosDesplazamiento,
    minutosIntervensionBrutos,
    minutosIntervensionNetos,
    minutosPausaComida,
    puedeEliminarParteIncompletoSinOrden,
    puedeRegistrarParte,
    quitarMaterialInventario,
    totalMaterialesPreview,
  };
}
