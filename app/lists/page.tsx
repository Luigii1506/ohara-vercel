import { ListsWorkspace } from "@/components/lists/ListsWorkspace";

export default function ListsPage() {
  return (
    <ListsWorkspace
      title="Mis Carpetas"
      createLabel="Nueva Carpeta"
      emptyTitle="No tienes carpetas aún"
      emptyDescription="Crea tu primera carpeta para organizar binders, master sets, faltantes o proyectos de colección."
      filteredEmptyTitle="No se encontraron carpetas"
      filteredEmptyDescription="Ajusta tus filtros o crea una nueva carpeta para comenzar."
      searchPlaceholder="Buscar carpetas..."
      defaultPurpose="all"
    />
  );
}
