import { describe, expect, it } from 'vitest';
import { construirUrlRutaCliente } from './parteTrabajoViewUtils';

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
});

