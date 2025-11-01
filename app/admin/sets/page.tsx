"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import EditSetModal from "@/app/admin/sets/components/EditSetModal";
import DeleteSetModal from "@/app/admin/sets/components/DeleteSetModal";

interface Set {
  id: number;
  title: string;
  code?: string;
  image?: string;
  releaseDate: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    cards: number;
  };
}

const SetsAdmin = () => {
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<Set[]>([]);
  const [filteredSets, setFilteredSets] = useState<Set[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [sortBy, setSortBy] = useState<
    "title" | "code" | "releaseDate" | "createdAt"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Estados para modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSet, setEditingSet] = useState<Set | null>(null);
  const [deletingSet, setDeletingSet] = useState<Set | null>(null);

  // Contador total
  const totalSets = sets.length;

  // Cargar sets al montar el componente
  useEffect(() => {
    fetchSets();
  }, []);

  // Aplicar filtros cuando cambien los criterios
  useEffect(() => {
    applyFilters();
  }, [sets, searchTerm, sortBy, sortOrder]);

  const fetchSets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/sets");

      if (!response.ok) {
        throw new Error("Error al obtener sets");
      }

      const data = await response.json();
      setSets(data);
    } catch (error) {
      console.error("Error fetching sets:", error);
      showErrorToast("Error al cargar los sets");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = sets;

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (set) =>
          set.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (set.code &&
            set.code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "code":
          aValue = (a.code || "").toLowerCase();
          bValue = (b.code || "").toLowerCase();
          break;
        case "releaseDate":
          aValue = new Date(a.releaseDate).getTime();
          bValue = new Date(b.releaseDate).getTime();
          break;
        case "createdAt":
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredSets(filtered);
    setCurrentPage(1); // Reset pagination
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleCreateSet = () => {
    setEditingSet(null);
    setShowEditModal(true);
  };

  const handleEditSet = (set: Set) => {
    setEditingSet(set);
    setShowEditModal(true);
  };

  const handleDeleteSet = (set: Set) => {
    setDeletingSet(set);
    setShowDeleteModal(true);
  };

  const handleSetSaved = async (savedSet: Set) => {
    setShowEditModal(false);
    await fetchSets(); // Refresh data
    showSuccessToast(
      editingSet ? "Set actualizado correctamente" : "Set creado correctamente"
    );
  };

  const handleSetDeleted = async () => {
    setShowDeleteModal(false);
    await fetchSets(); // Refresh data
    showSuccessToast("Set eliminado correctamente");
  };

  // Paginación
  const totalPages = Math.ceil(filteredSets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSets = filteredSets.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header simple con acciones */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-semibold text-gray-900">Sets</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSets}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={handleCreateSet}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Set
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Herramientas de búsqueda y filtro */}
          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por título o código..."
                      className="pl-10 border-gray-300"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Información total */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Total: {totalSets} sets
                    </span>
                  </div>

                  {/* Ordenar por */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Ordenar:</span>
                    <Button
                      variant={sortBy === "title" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSort("title")}
                      className="flex items-center gap-1"
                    >
                      Título
                      {sortBy === "title" &&
                        (sortOrder === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </Button>
                    <Button
                      variant={sortBy === "releaseDate" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSort("releaseDate")}
                      className="flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3" />
                      Fecha
                      {sortBy === "releaseDate" &&
                        (sortOrder === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </Button>
                    <Button
                      variant={sortBy === "createdAt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center gap-1"
                    >
                      Creado
                      {sortBy === "createdAt" &&
                        (sortOrder === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de sets */}
          <Card className="!h-max border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("title")}
                      >
                        <div className="flex items-center gap-1">
                          Set
                          {sortBy === "title" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("code")}
                      >
                        <div className="flex items-center gap-1">
                          Código
                          {sortBy === "code" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("releaseDate")}
                      >
                        <div className="flex items-center gap-1">
                          Fecha de Lanzamiento
                          {sortBy === "releaseDate" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead>Cartas</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("createdAt")}
                      >
                        <div className="flex items-center gap-1">
                          Creado
                          {sortBy === "createdAt" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            Cargando sets...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : currentSets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            {searchTerm
                              ? "No se encontraron sets con los filtros aplicados"
                              : "No hay sets creados aún"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentSets.map((set) => (
                        <TableRow key={set.id} className="hover:bg-gray-50">
                          <TableCell>
                            <p className="font-medium text-gray-900">
                              {set.title}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono text-gray-600">
                              {set.code || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {formatDate(set.releaseDate)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {set._count?.cards || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">
                              {formatDate(set.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSet(set)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSet(set)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Mostrando {startIndex + 1} a{" "}
                    {Math.min(endIndex, filteredSets.length)} de{" "}
                    {filteredSets.length} sets
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>

                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const pageNum = currentPage - 2 + i;
                      if (pageNum < 1 || pageNum > totalPages) return null;

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modales */}
        <EditSetModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          editingSet={editingSet}
          onSetSaved={handleSetSaved}
        />

        <DeleteSetModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          setToDelete={deletingSet}
          onSetDeleted={handleSetDeleted}
        />
      </div>
    </div>
  );
};

export default SetsAdmin;
