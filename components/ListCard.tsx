import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grid3X3, List, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "./skeletons";

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
  _count: {
    cards: number;
  };
}

interface ListCardProps {
  list: UserList;
  onDelete?: (listId: number) => void;
  deletingId?: number | null;
  showActions?: boolean;
}

const ListCard: React.FC<ListCardProps> = ({
  list,
  onDelete,
  deletingId,
  showActions = true,
}) => {
  const getListTypeIcon = () => {
    if (list.isCollection) {
      return <Grid3X3 className="h-5 w-5 text-yellow-600" />;
    }
    return list.isOrdered ? (
      <Grid3X3 className="h-5 w-5 text-blue-600" />
    ) : (
      <List className="h-5 w-5 text-green-600" />
    );
  };

  const getListTypeLabel = () => {
    if (list.isCollection) return "Colección";
    return list.isOrdered ? "Ordenada" : "Simple";
  };

  const getListTypeBadgeColor = () => {
    if (list.isCollection) return "bg-yellow-100 text-yellow-800";
    return list.isOrdered
      ? "bg-blue-100 text-blue-800"
      : "bg-green-100 text-green-800";
  };

  return (
    <Card
      className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 border-2"
      style={{
        borderColor: list.color || (list.isCollection ? "#f59e0b" : "#e5e7eb"),
      }}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {getListTypeIcon()}
            <div>
              <h3 className="font-bold text-xl text-gray-900 line-clamp-1">
                {list.name}
              </h3>
              <Badge
                variant="secondary"
                className={`text-xs ${getListTypeBadgeColor()}`}
              >
                {getListTypeLabel()}
              </Badge>
            </div>
          </div>

          {list.isPublic && (
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Pública
            </Badge>
          )}
        </div>

        {/* Description */}
        {list.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {list.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="font-medium">
              {list._count.cards} carta{list._count.cards !== 1 ? "s" : ""}
            </span>

            {list.isOrdered && (
              <span>
                {list.maxRows}×{list.maxColumns} • {list.totalPages} pág
                {list.totalPages !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            <Link href={`/lists/${list.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                Ver
              </Button>
            </Link>

            {!list.isCollection && (
              <>
                <Link href={`/lists/${list.id}/edit`}>
                  <Button variant="outline" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>

                {list.isDeletable && onDelete && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onDelete(list.id)}
                    disabled={deletingId === list.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingId === list.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Created date */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Creada el{" "}
            {new Date(list.createdAt).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListCard;
