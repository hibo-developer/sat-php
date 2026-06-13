import { describe, expect, it } from 'vitest';
import {
  formatearNombreInformePdf,
  formatearReferenciaInforme,
  resolverNombreDescargaInforme,
} from './informeNombre';

describe('informeNombre', () => {
  it('asigna 01 al primer informe del día', () => {
    const referencia = formatearReferenciaInforme(new Date(2026, 5, 13, 9, 30), 1);
    expect(referencia).toBe('SAT-260613-01');
  });

  it('incrementa a 02 para el segundo informe del mismo día', () => {
    const referencia = formatearReferenciaInforme(new Date(2026, 5, 13, 12, 15), 2);
    expect(referencia).toBe('SAT-260613-02');
  });

  it('reinicia la secuencia al cambiar de día', () => {
    const referencia = formatearReferenciaInforme(new Date(2026, 5, 14, 8, 0), 1);
    expect(referencia).toBe('SAT-260614-01');
  });

  it('mantiene el nombre SAT al descargar si la orden ya tiene referencia persistida', () => {
    expect(
      resolverNombreDescargaInforme({
        referenciaInforme: 'SAT-260613-07',
        informePdfUrl: 'sb://informes-partes/demo/demo/demo/otro.pdf',
      }),
    ).toBe('SAT-260613-07.pdf');
  });

  it('añade la extension pdf una sola vez', () => {
    expect(formatearNombreInformePdf('SAT-260613-03')).toBe('SAT-260613-03.pdf');
    expect(formatearNombreInformePdf('SAT-260613-03.pdf')).toBe('SAT-260613-03.pdf');
  });
});
