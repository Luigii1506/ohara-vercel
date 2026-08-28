import { ListsWorkspace } from "@/components/lists/ListsWorkspace";

export default function ListsPage() {
  return (
    <ListsWorkspace
      title="Mis Listas"
      createLabel="Nueva Lista"
      emptyTitle="No tienes listas aún"
      emptyDescription="Crea tu primera lista para organizar binders, inventario o ideas de colección."
      filteredEmptyTitle="No se encontraron listas"
      filteredEmptyDescription="Ajusta tus filtros o crea una nueva lista para comenzar."
      searchPlaceholder="Buscar listas..."
      defaultPurpose="all"
    />
  );
}
