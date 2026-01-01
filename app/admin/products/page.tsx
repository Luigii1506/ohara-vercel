"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductItem = {
  id: number;
  name: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  productType: string;
  isArchived: boolean;
  createdAt: string;
};

type ProductsResponse = {
  items: ProductItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PRODUCT_TYPES = [
  { key: "all", label: "Todos" },
  { key: "PLAYMAT", label: "Playmat" },
  { key: "SLEEVE", label: "Sleeve" },
  { key: "DECK_BOX", label: "Deck Box" },
  { key: "STORAGE_BOX", label: "Storage Box" },
  { key: "UNCUT_SHEET", label: "Uncut Sheet" },
  { key: "PROMO_PACK", label: "Promo Pack" },
  { key: "DISPLAY_BOX", label: "Display Box" },
  { key: "COLLECTORS_SET", label: "Collector Set" },
  { key: "TIN_PACK", label: "Tin Pack" },
  { key: "ILLUSTRATION_BOX", label: "Illustration Box" },
  { key: "ANNIVERSARY_SET", label: "Anniversary Set" },
  { key: "PREMIUM_CARD_COLLECTION", label: "Premium Card Collection" },
  { key: "DOUBLE_PACK", label: "Double Pack" },
  { key: "DEVIL_FRUIT", label: "Devil Fruit" },
  { key: "BOOSTER", label: "Booster" },
  { key: "DECK", label: "Deck" },
  { key: "STARTER_DECK", label: "Starter Deck" },
  { key: "PREMIUM_BOOSTER_BOX", label: "Premium Booster Box" },
  { key: "OTHER", label: "Other" },
];

const AdminProductsPage = () => {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async (nextPage: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", nextPage.toString());
      params.set("limit", "50");
      params.set("type", typeFilter);
      params.set("sort", "recent");
      params.set(
        "archived",
        archiveFilter === "all"
          ? "all"
          : archiveFilter === "archived"
          ? "true"
          : "false"
      );
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      const data = (await response.json()) as ProductsResponse;
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error(error);
      if (!append) {
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, false);
  }, [typeFilter, archiveFilter, search]);

  const handleRefresh = () => {
    fetchProducts(1, false);
  };

  const handleLoadMore = () => {
    if (loading || page >= totalPages) return;
    fetchProducts(page + 1, true);
  };

  const toggleArchive = async (productId: number, nextArchived: boolean) => {
    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, isArchived: nextArchived } : item
      )
    );
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      if (!response.ok) {
        throw new Error("Failed to update product");
      }
    } catch (error) {
      console.error(error);
      setItems(previous);
    }
  };

  const activeTypeLabel = useMemo(() => {
    return PRODUCT_TYPES.find((item) => item.key === typeFilter)?.label ?? "";
  }, [typeFilter]);

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona el catalogo de productos aprobados.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-52">
          <Select value={archiveFilter} onValueChange={setArchiveFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? "Cargando..." : `${total} producto(s)`}
          {typeFilter !== "all" && (
            <Badge className="ml-2" variant="secondary">
              {activeTypeLabel}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Imagen</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  Cargando productos...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  No hay productos con esos filtros.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="h-14 w-14 overflow-hidden rounded border bg-muted">
                      {item.thumbnailUrl || item.imageUrl ? (
                        <img
                          src={item.thumbnailUrl || item.imageUrl || ""}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          Sin imagen
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.productType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isArchived ? "secondary" : "default"}>
                      {item.isArchived ? "Archivado" : "Activo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleArchive(item.id, !item.isArchived)}
                    >
                      {item.isArchived ? "Reactivar" : "Archivar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {page < totalPages && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Cargando..." : "Cargar mas"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
