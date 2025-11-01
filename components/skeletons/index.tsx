import React from "react";

// Skeleton básico reutilizable
export const Skeleton = ({
  className = "",
  ...props
}: {
  className?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-200 to-slate-300 rounded ${className}`}
      {...props}
    />
  );
};

// Skeleton para lista de carpetas/listas en el sidebar
export const ListsSidebarSkeleton = () => {
  return (
    <div className="p-3 space-y-2">
      {/* Header skeleton */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Search skeleton */}
      <div className="space-y-3 border-b border-slate-200 pb-3">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>

      {/* Lists skeleton */}
      <div className="space-y-4">
        {/* Collections group */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="w-8 h-8 rounded-md" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-3 h-3" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Folders group */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="w-8 h-8 rounded-md" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="w-3 h-3" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Simple lists group */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="w-8 h-8 rounded-md" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="w-3 h-3" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-18" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton para cards en el sidebar (modo agregar)
export const CardsSidebarSkeleton = () => {
  return (
    <div className="p-3 space-y-3">
      {/* Header skeleton */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Search and filters skeleton */}
      <div className="space-y-3 border-b border-slate-200 pb-3">
        <Skeleton className="h-10 w-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-8" />
          <div className="flex gap-2 ml-auto">
            <Skeleton className="w-8 h-8" />
            <Skeleton className="w-8 h-8" />
            <Skeleton className="w-8 h-8" />
            <Skeleton className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid gap-3 grid-cols-3">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="rounded-lg border shadow p-3 bg-white">
            <Skeleton className="w-full aspect-[2.5/3.5] rounded mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton para el contenido principal cuando no hay lista seleccionada
export const MainContentSkeleton = () => {
  return (
    <div className="flex-1 p-6">
      {/* Header skeleton */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-2" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        {/* Page navigation skeleton */}
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-8 w-8" />
          <div className="text-center px-3 space-y-1">
            <Skeleton className="h-4 w-20 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Folder content skeleton */}
      <div className="h-full flex items-center justify-center">
        <div className="relative">
          {/* Folder outline */}
          <div className="w-80 h-96 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg relative animate-pulse">
            {/* Grid positions */}
            <div className="absolute inset-4 grid grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => (
                <Skeleton key={i} className="aspect-[2.5/3.5] rounded-sm" />
              ))}
            </div>
          </div>

          {/* Folder name */}
          <div className="mt-4 text-center">
            <Skeleton className="h-5 w-32 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Skeleton para lista simple
export const SimpleListSkeleton = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Cards list */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              {/* Card image */}
              <Skeleton className="w-20 h-28 rounded-lg" />

              {/* Card info */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-3 bg-white rounded-lg border p-2">
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-6 h-5" />
                <Skeleton className="w-8 h-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton para tabla de datos (admin tables)
export const TableSkeleton = ({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Table header skeleton */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-left">
                <Skeleton className="w-4 h-4" />
              </th>
              {[...Array(columns - 1)].map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100">
                <td className="p-4">
                  <Skeleton className="w-4 h-4" />
                </td>
                {[...Array(columns - 1)].map((_, colIndex) => (
                  <td key={colIndex} className="p-4">
                    {colIndex === 0 ? (
                      // First column usually has more content
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ) : colIndex === columns - 2 ? (
                      // Last content column (before actions)
                      <Skeleton className="h-6 w-16 rounded-full" />
                    ) : (
                      // Regular columns
                      <Skeleton className="h-4 w-16" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between p-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-8 h-8" />
            ))}
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
};

// Skeleton para card detail modal
export const CardDetailSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Card image and basic info */}
      <div className="flex gap-6">
        <Skeleton className="w-64 aspect-[2.5/3.5] rounded-lg" />
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-20" />
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-4/6" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton para página de lista de cartas
export const CardListPageSkeleton = () => {
  return (
    <div
      className="bg-[#f2eede] flex-1 overflow-hidden flex flex-col max-h-dvh"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      {/* Header y filtros */}
      <div className="bg-white w-full">
        {/* Desktop filters */}
        <div className="justify-center border-b border-[#f5f5f5] py-3 px-5 hidden md:flex gap-5">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Mobile filters */}
        <div className="flex md:hidden p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <Skeleton className="h-10 w-full" />
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Results bar */}
      <div className="py-2 px-4 border-b bg-white flex justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex flex-row gap-3 items-center">
          <Skeleton className="h-10 w-32" />
          <div className="hidden md:flex gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="p-3 md:p-5 overflow-y-auto flex-1">
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 justify-items-center">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="w-full max-w-[450px] border rounded-lg shadow p-3 bg-white"
            >
              <Skeleton className="w-full aspect-[2.5/3.5] rounded mb-2" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton para página completa
export const PageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <TableSkeleton />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default {
  Skeleton,
  ListsSidebarSkeleton,
  CardsSidebarSkeleton,
  MainContentSkeleton,
  SimpleListSkeleton,
  TableSkeleton,
  CardDetailSkeleton,
  CardListPageSkeleton,
  PageSkeleton,
};
