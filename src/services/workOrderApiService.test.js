import { describe, expect, it } from 'vitest';
import { mapearValoracionEconomicaParaInforme } from './workOrderApiService';

describe('workOrderApiService', () => {
  it('mapea la valoración económica del backend al formato que espera el PDF', () => {
    const valoracion = mapearValoracionEconomicaParaInforme({
      coste_materiales_editable: 125.5,
      tarifa_mano_obra_hora: 48,
      horas_mano_obra: 2.5,
      mecanicos_intervinieron: 2,
      tarifa_desplazamiento_km: 0.75,
      km_desplazamiento_facturables: 14,
      recargo_festivo_pct: 25,
      recargo_fuera_horario_pct: 20,
      aplica_recargo_festivo: true,
      aplica_recargo_fuera_horario: false,
      coste_mano_obra_total: 300,
      coste_desplazamiento_total: 10.5,
      coste_total: 436,
    });

    expect(valoracion).toEqual({
      costeMaterialesEditable: 125.5,
      tarifaManoObraHora: 48,
      horasManoObra: 2.5,
      mecanicosIntervinieron: 2,
      tarifaDesplazamientoKm: 0.75,
      kmDesplazamientoFacturables: 14,
      recargoFestivoPct: 25,
      recargoFueraHorarioPct: 20,
      aplicaRecargoFestivo: true,
      aplicaRecargoFueraHorario: false,
      costeManoObraTotal: 300,
      costeDesplazamientoTotal: 10.5,
      costeTotal: 436,
    });
  });
});
