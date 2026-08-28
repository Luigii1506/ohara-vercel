import { ListsWorkspace } from "@/components/lists/ListsWorkspace";

export default function InventoryPage() {
  return (
    <ListsWorkspace
      title="Mi Inventario"
      createLabel="Nuevo Inventario"
      emptyTitle="No tienes inventarios aún"
      emptyDescription="Crea carpetas o listas de inventario para separar stock, precios y cartas disponibles."
      filteredEmptyTitle="No se encontraron inventarios"
      filteredEmptyDescription="Ajusta tus filtros o crea un inventario nuevo."
      searchPlaceholder="Buscar inventario..."
      defaultPurpose="INVENTORY"
      lockedPurpose="INVENTORY"
    />
  );
}
