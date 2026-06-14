import { TriangleAlert } from 'lucide-react';

const variantes = {
  neutral: {
    contenedor: 'border-slate-300 bg-slate-50 text-slate-600',
    icono: 'text-slate-500',
  },
  error: {
    contenedor: 'border-rose-300 bg-rose-50 text-rose-700',
    icono: 'text-rose-500',
  },
};

export function EstadoVacioContenido({ mensaje, variant = 'neutral' }) {
  const estilos = variantes[variant] || variantes.neutral;

  return (
    <div className={`flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm font-medium ${estilos.contenedor}`}>
      <TriangleAlert className={`h-4 w-4 ${estilos.icono}`} />
      {mensaje}
    </div>
  );
}
