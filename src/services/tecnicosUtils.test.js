import { describe, expect, it } from 'vitest';
import { deduplicarTecnicosParaSelector, normalizarNombreTecnico } from './tecnicosUtils';

describe('tecnicosUtils', () => {
  it('normaliza nombres para detectar duplicados con distinto formato', () => {
    expect(normalizarNombreTecnico('  Juan   Perez ')).toBe('juan perez');
    expect(normalizarNombreTecnico('JUAN PEREZ')).toBe('juan perez');
  });

  it('deduplica técnicos por nombre manteniendo el primer registro visible', () => {
    const tecnicos = [
      { id: 'tec-1', nombre: 'Juan Perez', especialidad: 'Clima' },
      { id: 'tec-2', nombre: 'Juan Perez', especialidad: 'Frio' },
      { id: 'tec-3', nombre: 'Ana Lopez', especialidad: 'SAT' },
    ];

    expect(deduplicarTecnicosParaSelector(tecnicos)).toEqual([
      { id: 'tec-1', nombre: 'Juan Perez', especialidad: 'Clima' },
      { id: 'tec-3', nombre: 'Ana Lopez', especialidad: 'SAT' },
    ]);
  });

  it('preserva el técnico seleccionado cuando el duplicado visible tiene otro id', () => {
    const tecnicos = [
      { id: 'tec-1', nombre: 'Juan Perez', especialidad: 'Clima' },
      { id: 'tec-2', nombre: 'Juan Perez', especialidad: 'Frio' },
      { id: 'tec-3', nombre: 'Ana Lopez', especialidad: 'SAT' },
    ];

    expect(deduplicarTecnicosParaSelector(tecnicos, 'tec-2')).toEqual([
      { id: 'tec-2', nombre: 'Juan Perez', especialidad: 'Frio' },
      { id: 'tec-3', nombre: 'Ana Lopez', especialidad: 'SAT' },
    ]);
  });
});
