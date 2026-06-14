export function obtenerFechaRegeneracionDesdeUrl(urlInforme) {
  const url = String(urlInforme || '');
  const coincidencia = /informe-parte-[^-]+-(\d+)\.pdf/i.exec(url);
  if (!coincidencia) {
    return null;
  }

  const epochMs = Number.parseInt(coincidencia[1], 10);
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return null;
  }

  const fecha = new Date(epochMs);
  return Number.isFinite(fecha.getTime()) ? fecha.toLocaleString('es-ES') : null;
}

export function esFinDeSemana(fechaIso) {
  if (!fechaIso) {
    return false;
  }

  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) {
    return false;
  }

  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

export function esFueraHorarioLaboral(fechaIso) {
  if (!fechaIso) {
    return false;
  }

  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) {
    return false;
  }

  const hora = fecha.getHours();
  return hora < 8 || hora >= 18;
}

export function detectarFueraHorario(inicioIso, finIso) {
  return esFueraHorarioLaboral(inicioIso) || esFueraHorarioLaboral(finIso);
}

export function isoADatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function datetimeLocalAIso(valor) {
  const v = String(valor || '').trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function horasManoObraDesdeIntervencionDatetimeLocal(inicioDatetimeLocal, finDatetimeLocal) {
  const inicioIso = datetimeLocalAIso(inicioDatetimeLocal);
  const finIso = datetimeLocalAIso(finDatetimeLocal);
  if (!inicioIso || !finIso) return null;
  const ms = new Date(finIso).getTime() - new Date(inicioIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutos = Math.max(1, Math.ceil(ms / 60000));
  const horas = minutos < 60 ? 1 : Number((minutos / 60).toFixed(2));
  return horas.toFixed(2);
}
