import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  import('./services/parteTrabajoInformeService')
    .then((m) => {
      const satPdfPreviewApi = {
        generarInformeDemo: m.generarInformeParteDemoLocal,
      };
      window.__satPdfPreview = satPdfPreviewApi;
      window._satPdfPreview = satPdfPreviewApi;
      window._satPdfPrewiew = satPdfPreviewApi;
    })
    .catch(() => {});
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const esHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  if (import.meta.env.PROD && esHttp) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister().catch(() => {})))
      .catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
