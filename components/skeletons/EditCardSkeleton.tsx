import React from "react";

export const EditCardSkeleton = () => {
  return (
    <div
      className="flex bg-[#f2eede] w-full h-full"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      {/* Sidebar Skeleton */}
      <div className="bg-white w-full md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col flex">
        {/* Search and Filters Skeleton */}
        <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          {/* Search bar skeleton */}
          <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>

          {/* MultiSelect skeleton */}
          <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>

          {/* Filter buttons skeleton */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-gray-200 animate-pulse rounded-lg"></div>
              <div className="h-9 w-16 bg-gray-200 animate-pulse rounded-lg"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-9 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-9 w-9 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>

        {/* Cards List Skeleton */}
        <div className="p-3 pb-20 md:pb-3 overflow-y-auto flex-1 min-h-0">
          {/* Count skeleton */}
          <div className="h-4 w-32 bg-gray-200 animate-pulse rounded mb-3"></div>

          {/* Cards grid skeleton */}
          <div className="grid gap-3 grid-cols-3 justify-items-center">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-full">
                <div className="border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col">
                  {/* Card image skeleton */}
                  <div className="w-full aspect-[2.5/3.5] bg-gray-200 animate-pulse rounded"></div>

                  {/* Card info skeleton */}
                  <div className="flex justify-center items-center w-full flex-col p-1 gap-1">
                    <div className="h-4 w-16 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-3 w-20 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area Skeleton */}
      <div className="flex-1 flex-col flex">
        {/* Empty state skeleton */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-200 animate-pulse rounded-full mx-auto mb-8"></div>
            <div className="h-8 w-64 bg-gray-200 animate-pulse rounded mb-4 mx-auto"></div>
            <div className="h-4 w-80 bg-gray-200 animate-pulse rounded mb-2 mx-auto"></div>
            <div className="h-4 w-72 bg-gray-200 animate-pulse rounded mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CardDetailSkeleton = () => {
  return (
    <>
      {/* Header Skeleton */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Card image skeleton */}
              <div className="w-16 h-20 bg-gray-200 animate-pulse rounded border"></div>
            </div>
            <div>
              {/* Card name skeleton */}
              <div className="h-6 w-48 bg-gray-200 animate-pulse rounded mb-2"></div>
              <div className="flex gap-2">
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 w-16 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>
          </div>

          {/* Action buttons skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-9 w-24 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </div>

      {/* Alternates Grid Skeleton */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="gap-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 220px)",
            justifyContent: "start",
            width: "100%",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Card image skeleton */}
              <div className="aspect-[2.5/3.5] bg-gray-200 animate-pulse"></div>

              {/* Card info skeleton */}
              <div className="p-3 space-y-2">
                <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                <div className="flex items-center gap-1">
                  <div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
