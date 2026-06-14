import { EstadoVacioContenido } from './EstadoVacioContenido';

export function OrdenesListado({
  ordenes,
  renderOrden,
  mensajeVacio = 'No hay elementos disponibles.',
}) {
  if (!ordenes.length) {
    return <EstadoVacioContenido mensaje={mensajeVacio} />;
  }

  return (
    <>
      {ordenes.map((orden) => renderOrden(orden))}
    </>
  );
}
