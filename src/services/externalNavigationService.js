export async function abrirGoogleMaps({ lat = null, lng = null, address = '' } = {}) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const tieneCoords =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    !(latNum === 0 && lngNum === 0);

  let url = '';
  if (tieneCoords) {
    url = `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`;
  } else if (address) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address))}`;
  }

  if (!url || typeof window === 'undefined') {
    return { disponible: false, opened: false };
  }

  const nuevaVentana = window.open(url, '_blank', 'noopener,noreferrer');
  return { disponible: true, opened: Boolean(nuevaVentana) };
}
