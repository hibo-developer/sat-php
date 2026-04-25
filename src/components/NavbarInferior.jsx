import { ClipboardList, FilePlus2, Settings, Users } from 'lucide-react';

const ITEMS = [
  { key: 'ordenes', label: 'Órdenes', icono: ClipboardList },
  { key: 'parte', label: 'Parte', icono: FilePlus2 },
  { key: 'clientes', label: 'Clientes', icono: Users },
  { key: 'admin', label: 'Admin', icono: Settings },
];

export function NavbarInferior({ vistaActiva, onCambiarVista, mostrarAdmin = false, mostrarClientes = true }) {
  const itemsVisibles = ITEMS.filter((item) => {
    if (item.key === 'admin') {
      return mostrarAdmin;
    }

    if (item.key === 'clientes') {
      return mostrarClientes;
    }

    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-marca-100 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between gap-2 sm:max-w-lg">
        {itemsVisibles.map((item) => {
          const Icono = item.icono;
          const activo = vistaActiva === item.key;

          return (
            <li key={item.key} className="flex-1">
              <button
                type="button"
                onClick={() => onCambiarVista(item.key)}
                className={`flex w-full flex-col items-center justify-center rounded-2xl px-2 py-3 text-sm font-semibold transition active:scale-95 ${
                  activo
                    ? 'bg-cotepa-rojo-500 text-white shadow-lg'
                    : 'bg-marca-50 text-marca-700 hover:bg-marca-100'
                }`}
              >
                <Icono className="mb-1 h-6 w-6" strokeWidth={2.25} />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
