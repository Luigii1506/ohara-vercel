"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, Eye, Trash2, ArrowUpDown } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingProduct {
  id: number;
  title: string;
  sourceUrl?: string | null;
  productType?: string | null;
  category?: string | null;
  releaseDate?: string | null;
  officialPrice?: string | number | null;
  officialPriceCurrency?: string | null;
  thumbnailUrl?: string | null;
  images: string[];
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

const AdminMissingProductsPage = () => {
  const [items, setItems] = useState<MissingProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const formatSourceLabel = (url?: string | null) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  useEffect(() => {
    fetchMissingProducts();
  }, [sortOrder]);

  const fetchMissingProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/missing-products?order=${sortOrder}`
      );
      if (!response.ok) throw new Error("Failed to fetch missing products");
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar missing products");
    } finally {
      setLoading(false);
    }
  };

  const deleteMissingProduct = async (item: MissingProduct) => {
    if (!window.confirm(`¿Eliminar "${item.title}"?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/missing-products/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete missing product");
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      showSuccessToast("Missing product eliminado");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al eliminar el missing product");
    }
  };

  const filteredItems = items.filter((item) => {
    const term = search.toLowerCase();
    return (
      !term ||
      item.title.toLowerCase().includes(term) ||
      item.productType?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Missing Products</h1>
        <p className="text-muted-foreground">
          Revisa productos pendientes de aprobación
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 order-2 sm:order-1">
          <Input
            placeholder="Buscar por título o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end order-1 sm:order-2">
          <Button
            onClick={() =>
              setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
            }
            variant="outline"
            size="icon"
            title={
              sortOrder === "desc"
                ? "Ordenar: Más recientes primero"
                : "Ordenar: Más antiguos primero"
            }
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button onClick={fetchMissingProducts} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No se encontraron missing products
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {item.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.images.length} imagen(es)
                    </p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-xs text-blue-600 hover:underline mt-1"
                      >
                        {formatSourceLabel(item.sourceUrl)}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-start gap-1.5">
                      {item.productType && (
                        <Badge variant="outline" className="text-xs">
                          {item.productType}
                        </Badge>
                      )}
                      {item.isApproved && (
                        <Badge variant="default" className="text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {!item.isApproved && (
                        <Button size="sm" asChild>
                          <Link
                            href={`/admin/missing-products/${item.id}/approve`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Aprobar
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMissingProduct(item)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {item.thumbnailUrl && (
                    <a
                      href={item.thumbnailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-16 h-20 rounded border overflow-hidden"
                    >
                      <img
                        src={item.thumbnailUrl}
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                  {item.images.slice(0, 8).map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-16 h-20 rounded border overflow-hidden"
                    >
                      <img
                        src={img}
                        alt={`${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMissingProductsPage;
