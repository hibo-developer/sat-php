import { useState } from 'react';

let orderExportServicePromise = null;

async function cargarOrderExportService() {
  if (!orderExportServicePromise) {
    orderExportServicePromise = import('../services/orderExportService')
      .catch((error) => {
        orderExportServicePromise = null;
        throw error;
      });
  }
  return orderExportServicePromise;
}

export function useOrdenesExportacion({
  ordenesAnalisis,
  ordenesFinalizadas,
  informesExportables,
  clienteAnalisisSeleccionado,
  mttrMinutos,
  cumplimientoSla48h,
  firstTimeFixProxy,
  costeTotalMateriales,
  onNotificar,
}) {
  const [exportandoZip, setExportandoZip] = useState(false);

  async function exportarOrdenesExcel() {
    try {
      const { exportarExcelProfesional } = await cargarOrderExportService();
      const filas = ordenesAnalisis.map((orden) => ({
        ticket: orden.numero_ticket || '',
        cliente: orden.cliente,
        equipo: orden.equipo,
        tecnico: orden.tecnico,
        estado: orden.estado,
        prioridad: orden.prioridad,
        tiempo_min: Number(orden.tiempoEmpleadoMinutos || 0),
        coste_materiales: Number(orden.costeMateriales || 0),
        fecha_inicio: orden.fechaInicioIso ? new Date(orden.fechaInicioIso).toLocaleString('es-ES') : '',
        fecha_fin: orden.fechaFinIso ? new Date(orden.fechaFinIso).toLocaleString('es-ES') : '',
        informe_pdf: orden.informePdfUrl || '',
      }));

      await exportarExcelProfesional({
        nombreArchivo: `ordenes-sat-${new Date().toISOString().slice(0, 10)}.xlsx`,
        hojaNombre: 'Ordenes SAT',
        titulo: 'SAT COTEPA · Exportación profesional de órdenes',
        subtitulo: `Generado el ${new Date().toLocaleString('es-ES')} · Cliente: ${clienteAnalisisSeleccionado}`,
        columnas: [
          { key: 'ticket', header: 'Ticket', width: 14 },
          { key: 'cliente', header: 'Cliente', width: 28 },
          { key: 'equipo', header: 'Equipo', width: 24 },
          { key: 'tecnico', header: 'Técnico', width: 24 },
          { key: 'estado', header: 'Estado', width: 16 },
          { key: 'prioridad', header: 'Prioridad', width: 14 },
          { key: 'tiempo_min', header: 'Tiempo (min)', width: 14, numFmt: '0' },
          { key: 'coste_materiales', header: 'Coste materiales (€)', width: 20, numFmt: '#,##0.00' },
          { key: 'fecha_inicio', header: 'Fecha inicio', width: 22 },
          { key: 'fecha_fin', header: 'Fecha fin', width: 22 },
          { key: 'informe_pdf', header: 'URL informe PDF', width: 38 },
        ],
        filas,
        resumen: [
          ['Órdenes en análisis', ordenesAnalisis.length],
          ['Órdenes finalizadas', ordenesFinalizadas.length],
          ['MTTR (min)', mttrMinutos],
          ['Coste materiales total (€)', Number(costeTotalMateriales)],
        ],
      });

      onNotificar({
        tipo: 'exito',
        titulo: 'Excel generado',
        descripcion: 'Se descargó un archivo .xlsx con formato profesional.',
      });
    } catch (err) {
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo exportar órdenes',
        descripcion: err.message || 'No se pudo generar el archivo Excel de órdenes.',
      });
    }
  }

  async function exportarKpisExcel() {
    try {
      const { exportarExcelProfesional } = await cargarOrderExportService();
      const filas = [
        { kpi: 'Total órdenes', valor: ordenesAnalisis.length },
        { kpi: 'Órdenes finalizadas', valor: ordenesFinalizadas.length },
        { kpi: 'MTTR (min)', valor: mttrMinutos },
        { kpi: 'SLA <=48h (%)', valor: cumplimientoSla48h },
        { kpi: 'First Time Fix proxy (%)', valor: firstTimeFixProxy },
        { kpi: 'Coste materiales total (€)', valor: Number(costeTotalMateriales) },
      ];

      await exportarExcelProfesional({
        nombreArchivo: `kpi-sat-${new Date().toISOString().slice(0, 10)}.xlsx`,
        hojaNombre: 'KPIs SAT',
        titulo: 'SAT COTEPA · Informe KPI profesional',
        subtitulo: `Generado el ${new Date().toLocaleString('es-ES')} · Cliente: ${clienteAnalisisSeleccionado}`,
        columnas: [
          { key: 'kpi', header: 'Indicador', width: 36 },
          { key: 'valor', header: 'Valor', width: 20 },
        ],
        filas,
      });

      onNotificar({
        tipo: 'exito',
        titulo: 'KPI Excel generado',
        descripcion: 'Se descargó un KPI en formato .xlsx con diseño profesional.',
      });
    } catch (err) {
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo exportar KPI',
        descripcion: err.message || 'No se pudo generar el archivo Excel de KPI.',
      });
    }
  }

  async function exportarInformesZip() {
    if (!informesExportables.length) {
      onNotificar({
        tipo: 'error',
        titulo: 'Sin informes disponibles',
        descripcion: 'No hay órdenes finalizadas con informe PDF para exportar.',
      });
      return;
    }

    setExportandoZip(true);

    try {
      const { exportarInformesZip: exportarZip } = await cargarOrderExportService();
      const { agregados } = await exportarZip({
        informes: informesExportables,
        nombreArchivo: `informes-sat-${new Date().toISOString().slice(0, 10)}.zip`,
      });

      onNotificar({
        tipo: 'exito',
        titulo: 'ZIP generado',
        descripcion: `Se descargaron ${agregados} informes en un archivo ZIP.`,
      });
    } catch (err) {
      onNotificar({
        tipo: 'error',
        titulo: 'No se pudo generar el ZIP',
        descripcion: err.message || 'Revisa conexión y permisos de acceso a informes.',
      });
    } finally {
      setExportandoZip(false);
    }
  }

  return {
    exportandoZip,
    exportarOrdenesExcel,
    exportarKpisExcel,
    exportarInformesZip,
  };
}
