import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { contarGpsPendientes, estaOnline, procesarColaGps } from '../services/offlineSyncService';
import {
  detenerTrackingBackground,
  iniciarTrackingBackground,
  obtenerEstadoTrackingBackground,
  obtenerTrackingBackgroundPendiente,
  volcarTrackingBackgroundPendiente,
} from '../services/backgroundLocationService';

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES');
}

export function TrackingView() {
  const location = useLocation();
  const ordenIdSugerida = location.state?.ordenId || '';
  const tecnicoIdSugerido = location.state?.tecnicoId || '';

  const [estado, setEstado] = useState({
    disponible: false,
    running: false,
    ordenId: '',
    tecnicoId: '',
    intervalMs: 0,
  });
  const [pendientesNativo, setPendientesNativo] = useState([]);
  const [pendientesDexie, setPendientesDexie] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const ordenIdEfectiva = estado.ordenId || ordenIdSugerida;
  const tecnicoIdEfectivo = estado.tecnicoId || tecnicoIdSugerido;

  const resumen = useMemo(() => {
    const totalNativo = pendientesNativo.length;
    const totalDexie = pendientesDexie;
    return { totalNativo, totalDexie, total: totalNativo + totalDexie };
  }, [pendientesDexie, pendientesNativo.length]);

  async function refrescar() {
    const [estadoRsp, pendientesRsp, pendientesDb] = await Promise.all([
      obtenerEstadoTrackingBackground(),
      obtenerTrackingBackgroundPendiente(),
      contarGpsPendientes(),
    ]);
    setEstado(estadoRsp);
    setPendientesNativo(pendientesRsp.disponible ? (pendientesRsp.items || []) : []);
    setPendientesDexie(pendientesDb);
  }

  useEffect(() => {
    let cancelado = false;
    async function boot() {
      setCargando(true);
      try {
        await refrescar();
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    boot();
    const interval = window.setInterval(() => {
      refrescar().catch(() => { /* noop */ });
    }, 2500);
    return () => {
      cancelado = true;
      window.clearInterval(interval);
    };
  }, []);

  async function iniciar() {
    setMensaje('');
    setError('');
    if (!ordenIdEfectiva || !tecnicoIdEfectivo) {
      setError('Falta orden o técnico para iniciar tracking.');
      return;
    }
    setAccion(true);
    try {
      await iniciarTrackingBackground({
        ordenId: ordenIdEfectiva,
        tecnicoId: tecnicoIdEfectivo,
        intervalMinutes: 5,
      });
      setMensaje('Tracking activado.');
      await refrescar();
    } catch (e) {
      setError(e?.message || 'No se pudo activar el tracking.');
    } finally {
      setAccion(false);
    }
  }

  async function detener() {
    setMensaje('');
    setError('');
    setAccion(true);
    try {
      await detenerTrackingBackground();
      setMensaje('Tracking desactivado.');
      await refrescar();
    } catch (e) {
      setError(e?.message || 'No se pudo desactivar el tracking.');
    } finally {
      setAccion(false);
    }
  }

  async function volcar() {
    setMensaje('');
    setError('');
    setAccion(true);
    try {
      const rsp = await volcarTrackingBackgroundPendiente();
      setMensaje(rsp.procesados ? `Volcado a cola: ${rsp.procesados} punto(s).` : 'No había puntos para volcar.');
      await refrescar();
    } catch (e) {
      setError(e?.message || 'No se pudo volcar el tracking.');
    } finally {
      setAccion(false);
    }
  }

  async function sincronizar() {
    setMensaje('');
    setError('');
    setAccion(true);
    try {
      const rsp = await procesarColaGps();
      setMensaje(rsp.procesados ? `Enviados: ${rsp.procesados} punto(s).` : 'No había puntos por enviar.');
      await refrescar();
    } catch (e) {
      setError(e?.message || 'No se pudo sincronizar GPS.');
    } finally {
      setAccion(false);
    }
  }

  return (
    <section className="space-y-4 pb-20 lg:pb-0">
      <header className="rounded-2xl bg-marca-900 p-4 text-white shadow-lg lg:p-5">
        <h2 className="text-lg font-bold lg:text-xl">Tracking</h2>
        <p className="mt-1 text-sm text-slate-200">Control del tracking GPS en segundo plano.</p>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{mensaje}</p>}

      {!estado.disponible && !cargando && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          El tracking en segundo plano solo está disponible en Android (APK). En web no se puede activar.
        </p>
      )}

      {estado.disponible && !cargando && (!ordenIdEfectiva || !tecnicoIdEfectivo) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Para activar el tracking necesitas una OT y un técnico. Entra desde el Parte (selecciona OT y técnico) y pulsa “Abrir tracking”.
        </p>
      )}

      <div className="grid gap-3 rounded-2xl border border-marca-100 bg-white p-4 shadow-tarjeta lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">
            Estado: {cargando ? 'Cargando…' : (estado.running ? 'ON' : 'OFF')}
          </p>
          <p className="text-xs font-semibold text-slate-600">
            {estaOnline() ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p><span className="font-semibold">Plugin nativo:</span> {estado.disponible ? 'Disponible' : 'No disponible (web)'} </p>
          <p><span className="font-semibold">OT:</span> {ordenIdEfectiva || '—'}</p>
          <p><span className="font-semibold">Técnico:</span> {tecnicoIdEfectivo || '—'}</p>
          <p><span className="font-semibold">Intervalo:</span> {estado.intervalMs ? `${Math.round(estado.intervalMs / 60000)} min` : '—'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={accion || !estado.disponible || estado.running || !ordenIdEfectiva || !tecnicoIdEfectivo}
            onClick={iniciar}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-60"
          >
            Activar
          </button>
          <button
            type="button"
            disabled={accion || !estado.disponible || !estado.running}
            onClick={detener}
            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 disabled:opacity-60"
          >
            Desactivar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={accion || !estado.disponible}
            onClick={volcar}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800 disabled:opacity-60"
          >
            Volcar pendientes
          </button>
          <button
            type="button"
            disabled={accion || !estaOnline()}
            onClick={sincronizar}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
          >
            Enviar ahora
          </button>
        </div>

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-800">Pendientes</p>
          <p className="text-xs text-slate-700">
            Nativo: <span className="font-semibold">{resumen.totalNativo}</span> · Cola app: <span className="font-semibold">{resumen.totalDexie}</span> · Total: <span className="font-semibold">{resumen.total}</span>
          </p>
          {pendientesNativo.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {pendientesNativo.slice(-10).reverse().map((p, idx) => (
                <li key={`${p.recorded_at || 'p'}-${idx}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-semibold">{formatearFecha(p.recorded_at)} · {p.tipo || 'tracking'}</p>
                  <p>{Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}{p.accuracy_m != null ? ` · ±${Math.round(Number(p.accuracy_m))}m` : ''}</p>
                </li>
              ))}
            </ul>
          )}
          {pendientesNativo.length === 0 && (
            <p className="text-xs text-slate-600">Sin puntos nativos pendientes.</p>
          )}
        </div>
      </div>
    </section>
  );
}
