"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Grid3X3,
  List,
  Info,
  Home,
  ChevronRight as ChevronRightBreadcrumb,
  Plus,
  Minus,
  Palette,
  Eye,
  EyeOff,
  Layout,
  Save,
  Calendar,
  BarChart3,
  AlertCircle,
  Lock,
  Edit3,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { PageSkeleton } from "@/components/skeletons";

interface UserList {
  id: number;
  name: string;
  description: string | null;
  isOrdered: boolean;
  isCollection: boolean;
  isDeletable: boolean;
  isPublic: boolean;
  color: string | null;
  totalPages: number;
  maxRows: number | null;
  maxColumns: number | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    cards: number;
  };
}

const EditListPage = () => {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  const [list, setList] = useState<UserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: false,
    color: "#3b82f6",
    maxRows: 3,
    maxColumns: 3,
  });

  useEffect(() => {
    fetchList();
  }, [listId]);

  const fetchList = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}`);
      if (response.ok) {
        const data = await response.json();
        setList(data.list);
        setFormData({
          name: data.list.name,
          description: data.list.description || "",
          isPublic: data.list.isPublic,
          color: data.list.color || "#3b82f6",
          maxRows: data.list.maxRows || 3,
          maxColumns: data.list.maxColumns || 3,
        });
      } else {
        toast.error("Error al cargar la lista");
        router.push("/lists");
      }
    } catch (error) {
      console.error("Error fetching list:", error);
      toast.error("Error al cargar la lista");
      router.push("/lists");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleNumberChange = (name: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      [name]: Math.max(1, Math.min(value, 10)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre de la lista es requerido");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Lista actualizada exitosamente");
        router.push(`/lists/${listId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al actualizar la lista");
      }
    } catch (error) {
      console.error("Error updating list:", error);
      toast.error("Error al actualizar la lista");
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    { value: "#3b82f6", label: "Azul", class: "bg-blue-500" },
    { value: "#10b981", label: "Verde", class: "bg-emerald-500" },
    { value: "#f59e0b", label: "Amarillo", class: "bg-amber-500" },
    { value: "#ef4444", label: "Rojo", class: "bg-red-500" },
    { value: "#8b5cf6", label: "Morado", class: "bg-violet-500" },
    { value: "#06b6d4", label: "Cian", class: "bg-cyan-500" },
    { value: "#f97316", label: "Naranja", class: "bg-orange-500" },
    { value: "#ec4899", label: "Rosa", class: "bg-pink-500" },
    { value: "#64748b", label: "Gris", class: "bg-slate-500" },
    { value: "#059669", label: "Esmeralda", class: "bg-emerald-600" },
    { value: "#dc2626", label: "Rojo Oscuro", class: "bg-red-600" },
    { value: "#7c3aed", label: "Violeta", class: "bg-violet-600" },
  ];

  const getListTypeConfig = () => {
    if (list?.isOrdered) {
      return {
        icon: <Layout className="h-5 w-5" />,
        label: "Carpeta",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
        description: "Cartas organizadas en páginas con posiciones específicas",
      };
    }

    return {
      icon: <List className="h-5 w-5" />,
      label: "Lista",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
      description: "Lista flexible sin orden específico",
    };
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4 w-full">
        <div className="w-full max-w-4xl mx-auto">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="h-full flex items-center justify-center p-4 w-full">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Lista no encontrada
            </h2>
            <p className="text-slate-600 mb-6">
              La lista que buscas no existe o no tienes permisos para editarla.
            </p>
            <Link href="/lists">
              <Button>Volver a las listas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (list.isCollection) {
    return (
      <div className="h-full flex items-center justify-center p-4 w-full">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <Lock className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No se puede editar
            </h2>
            <p className="text-slate-600 mb-6">
              La colección no se puede modificar.
            </p>
            <Link href={`/lists/${listId}`}>
              <Button>Volver a la lista</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeConfig = getListTypeConfig();

  return (
    <div className="h-full p-2 sm:p-4 lg:p-8 w-full">
      <div className="max-w-4xl mx-auto space-y-6 pb-5">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Link
            href="/lists"
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
            <span>Listas</span>
          </Link>
          <ChevronRightBreadcrumb className="h-4 w-4" />
          <Link
            href={`/lists/${listId}`}
            className="hover:text-blue-600 transition-colors"
          >
            <span>{list.name}</span>
          </Link>
          <ChevronRightBreadcrumb className="h-4 w-4" />
          <span className="text-slate-900 font-medium">Editar</span>
        </div>

        {/* Main Container Card */}
        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader
            className="border-b p-6 rounded-t-xl"
            style={{
              background: formData.color
                ? `linear-gradient(135deg, ${formData.color}15, ${formData.color}08)`
                : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
            }}
          >
            {/* Header */}
            <div className="flex flex-col gap-6">
              {/* Top Row - Back button */}
              <div className="flex items-center justify-between">
                <Link href={`/lists/${listId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="touch-manipulation"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Volver</span>
                  </Button>
                </Link>

                <Button
                  type="submit"
                  form="edit-list-form"
                  disabled={saving || !formData.name.trim()}
                  className="touch-manipulation"
                  style={{
                    backgroundColor: formData.color || "#3b82f6",
                    borderColor: formData.color || "#3b82f6",
                  }}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="ml-2 hidden sm:inline">
                        Guardando...
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Guardar</span>
                      <span className="sm:hidden">Guardar</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Title Section */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div
                    className="p-3 rounded-xl shadow-sm"
                    style={{
                      backgroundColor: formData.color
                        ? `${formData.color}20`
                        : "#f1f5f9",
                      color: formData.color || "#64748b",
                    }}
                  >
                    <Edit3 className="h-5 w-5" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 leading-tight">
                  Editar Lista
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <Badge className={`${typeConfig.badgeColor} border`}>
                    {typeConfig.label}
                  </Badge>
                  {formData.isPublic && (
                    <Badge variant="outline" className="border-slate-300">
                      <Eye className="h-3 w-3 mr-1" />
                      Pública
                    </Badge>
                  )}
                  {list.isCollection && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 text-amber-700"
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      Colección
                    </Badge>
                  )}
                </div>

                <p className="text-slate-600 text-lg leading-relaxed max-w-2xl mx-auto">
                  Modifica la configuración de tu lista
                </p>
              </div>

              {/* Preview Stats */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">{list._count.cards}</span>
                  <span>cartas</span>
                </div>

                {list.isOrdered && (
                  <>
                    <div className="flex items-center gap-2">
                      <Layout className="h-4 w-4" />
                      <span className="font-medium">
                        {formData.maxRows}×{formData.maxColumns}
                      </span>
                      <span>grilla</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-medium">{list.totalPages}</span>
                      <span>páginas</span>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Creada{" "}
                    {new Date(list.createdAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form
              id="edit-list-form"
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              {/* Basic Information */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label
                    htmlFor="name"
                    className="text-base font-semibold text-slate-900"
                  >
                    Nombre de la lista *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej: Mi mazo favorito, Cartas especiales..."
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor="description"
                    className="text-base font-semibold text-slate-900"
                  >
                    Descripción
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe el propósito de esta lista..."
                    className="min-h-[100px] text-base resize-none"
                    rows={4}
                  />
                </div>
              </div>

              {/* Configuration Cards */}
              <div className="grid gap-6">
                {/* List Type Card (Read-only) */}
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {typeConfig.icon}
                      <h3 className="text-lg font-semibold text-slate-900">
                        Tipo de Lista
                      </h3>
                      <Badge className={`${typeConfig.badgeColor} border`}>
                        {typeConfig.label}
                      </Badge>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Info className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-blue-900 mb-1">
                            Configuración Fija
                          </h4>
                          <p className="text-sm text-blue-700">
                            El tipo de lista no se puede cambiar después de la
                            creación.
                            {list.isOrdered &&
                              ` Configuración actual: ${list.maxRows}×${list.maxColumns} por página.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ordered List Settings */}
                {list.isOrdered && (
                  <Card className="border border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Layout className="h-5 w-5 text-slate-600" />
                          <h3 className="text-lg font-semibold text-slate-900">
                            Configuración de Grilla
                          </h3>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-amber-900 mb-1">
                                Cambios en la Grilla
                              </h4>
                              <p className="text-sm text-amber-700">
                                Modificar el tamaño de la grilla puede afectar
                                las cartas existentes. Úsalo con precaución.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-slate-900">
                                Filas por página
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleNumberChange(
                                      "maxRows",
                                      formData.maxRows - 1
                                    )
                                  }
                                  disabled={formData.maxRows <= 1}
                                  className="h-10 w-10 p-0 touch-manipulation"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  value={formData.maxRows}
                                  onChange={(e) =>
                                    handleNumberChange(
                                      "maxRows",
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  min={1}
                                  max={10}
                                  className="w-20 text-center h-10"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleNumberChange(
                                      "maxRows",
                                      formData.maxRows + 1
                                    )
                                  }
                                  disabled={formData.maxRows >= 10}
                                  className="h-10 w-10 p-0 touch-manipulation"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-slate-900">
                                Columnas por página
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleNumberChange(
                                      "maxColumns",
                                      formData.maxColumns - 1
                                    )
                                  }
                                  disabled={formData.maxColumns <= 1}
                                  className="h-10 w-10 p-0 touch-manipulation"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  value={formData.maxColumns}
                                  onChange={(e) =>
                                    handleNumberChange(
                                      "maxColumns",
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  min={1}
                                  max={10}
                                  className="w-20 text-center h-10"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleNumberChange(
                                      "maxColumns",
                                      formData.maxColumns + 1
                                    )
                                  }
                                  disabled={formData.maxColumns >= 10}
                                  className="h-10 w-10 p-0 touch-manipulation"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200">
                            <p className="text-sm text-slate-700 text-center">
                              <span className="font-medium">
                                Capacidad por página:
                              </span>{" "}
                              <span className="text-amber-600 font-semibold">
                                {formData.maxRows * formData.maxColumns} cartas
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Visibility Card */}
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {formData.isPublic ? (
                            <Eye className="h-5 w-5 text-green-600" />
                          ) : (
                            <EyeOff className="h-5 w-5 text-slate-500" />
                          )}
                          <h3 className="text-lg font-semibold text-slate-900">
                            Visibilidad
                          </h3>
                        </div>
                        <p className="text-slate-600">
                          {formData.isPublic
                            ? "Otros usuarios podrán ver esta lista"
                            : "Solo tú podrás ver esta lista"}
                        </p>
                      </div>
                      <Switch
                        checked={formData.isPublic}
                        onCheckedChange={(checked) =>
                          handleSwitchChange("isPublic", checked)
                        }
                        className="touch-manipulation"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Color Selection Card */}
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Palette className="h-5 w-5 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Color de la Lista
                        </h3>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                color: color.value,
                              }))
                            }
                            className={`
                              aspect-square rounded-xl border-2 transition-all duration-200 touch-manipulation
                              ${color.class}
                              ${
                                formData.color === color.value
                                  ? "border-slate-900 scale-110 shadow-lg"
                                  : "border-slate-300 hover:border-slate-400 hover:scale-105"
                              }
                            `}
                            title={color.label}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div
                          className="w-6 h-6 rounded-lg border border-slate-300"
                          style={{ backgroundColor: formData.color }}
                        />
                        <span className="text-sm text-slate-600">
                          Color seleccionado:{" "}
                          <span className="font-medium">
                            {colorOptions.find(
                              (c) => c.value === formData.color
                            )?.label || "Personalizado"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics Card */}
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Estadísticas
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-2xl font-bold text-slate-900">
                            {list._count.cards}
                          </div>
                          <div className="text-sm text-slate-600">
                            Cartas totales
                          </div>
                        </div>

                        {list.isOrdered && (
                          <>
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <div className="text-2xl font-bold text-slate-900">
                                {list.totalPages}
                              </div>
                              <div className="text-sm text-slate-600">
                                Páginas
                              </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg">
                              <div className="text-2xl font-bold text-slate-900">
                                {list.maxRows}×{list.maxColumns}
                              </div>
                              <div className="text-sm text-slate-600">
                                Configuración
                              </div>
                            </div>
                          </>
                        )}

                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-lg font-bold text-slate-900">
                            {new Date(list.createdAt).toLocaleDateString(
                              "es-ES"
                            )}
                          </div>
                          <div className="text-sm text-slate-600">
                            Fecha creación
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-lg font-bold text-slate-900">
                            {new Date(list.updatedAt).toLocaleDateString(
                              "es-ES"
                            )}
                          </div>
                          <div className="text-sm text-slate-600">
                            Última actualización
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200">
                <Link href={`/lists/${listId}`} className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 touch-manipulation"
                  >
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 h-12 touch-manipulation"
                  style={{
                    backgroundColor: formData.color || "#3b82f6",
                    borderColor: formData.color || "#3b82f6",
                  }}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="ml-2">Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditListPage;
