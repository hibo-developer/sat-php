import { describe, expect, it } from 'vitest';
import {
  construirUrlRutaCliente,
  normalizarCategoriaFotoIntervencion,
  resolverEtiquetaCategoriaFoto,
} from './parteTrabajoViewUtils';

describe('parteTrabajoViewUtils', () => {
  describe('construirUrlRutaCliente', () => {
    it('construye ruta por coordenadas en modo navegación', () => {
      const url = construirUrlRutaCliente({
        lat: 39.4415,
        lng: -0.382,
        direccion: '',
        modoNavegacion: true,
      });

      expect(url).toContain('https://www.google.com/maps/dir/?api=1');
      expect(url).toContain('destination=39.4415,-0.382');
      expect(url).toContain('travelmode=driving');
      expect(url).toContain('dir_action=navigate');
    });

    it('construye ruta por dirección si no hay coordenadas', () => {
      const url = construirUrlRutaCliente({
        lat: null,
        lng: null,
        direccion: 'Calle Mayor, 1, Valencia',
      });

      expect(url).toContain('https://www.google.com/maps/dir/?api=1');
      expect(url).toContain(`destination=${encodeURIComponent('Calle Mayor, 1, Valencia')}`);
      expect(url).toContain('travelmode=driving');
    });
  });

  describe('categorias de fotos', () => {
    it('normaliza categorias soportadas de fotos de intervencion', () => {
      expect(normalizarCategoriaFotoIntervencion('antes')).toBe('antes');
      expect(normalizarCategoriaFotoIntervencion('durante')).toBe('durante');
      expect(normalizarCategoriaFotoIntervencion('despues')).toBe('despues');
      expect(normalizarCategoriaFotoIntervencion('otra')).toBe('antes');
    });

    it('resuelve la etiqueta visible desde el nombre de archivo', () => {
      expect(resolverEtiquetaCategoriaFoto('ot_123_antes_01.jpg')).toBe('Antes');
      expect(resolverEtiquetaCategoriaFoto('ot_123_durante_01.jpg')).toBe('Durante');
      expect(resolverEtiquetaCategoriaFoto('ot_123_despues_01.jpg')).toBe('Después');
    });
  });
});
