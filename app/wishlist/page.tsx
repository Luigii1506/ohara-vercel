import { ListsWorkspace } from "@/components/lists/ListsWorkspace";

export default function WishlistPage() {
  return (
    <ListsWorkspace
      title="Mi Wishlist"
      createLabel="Nueva Wishlist"
      emptyTitle="No tienes wishlist aún"
      emptyDescription="Guarda aquí cartas, master sets o pendientes que quieras conseguir después."
      filteredEmptyTitle="No se encontraron wishlist"
      filteredEmptyDescription="Ajusta tus filtros o crea una wishlist nueva."
      searchPlaceholder="Buscar wishlist..."
      defaultPurpose="WISHLIST"
      lockedPurpose="WISHLIST"
    />
  );
}
