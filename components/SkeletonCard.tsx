import React from "react";

interface SkeletonCardProps {
  variant?: "list" | "text" | "alternate" | "grid";
  index?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant = "list", index = 0 }) => {
  if (variant === "list") {
    return (
      <div className="w-full animate-fade-in">

        <div className="border border-slate-100 rounded-xl shadow-sm p-3 bg-white overflow-hidden relative">
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{
              animation: "shimmer 2s infinite",
            }}
          />

          {/* Card image skeleton */}
          <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 rounded-lg w-full aspect-[2.5/3.5] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-200/20 to-transparent" />
          </div>

          {/* Text skeletons */}
          <div className="flex justify-center items-center w-full flex-col mt-2.5 space-y-1.5">
            <div className="h-3 w-14 rounded-md bg-gradient-to-r from-slate-200 to-slate-100" />
            <div className="h-2.5 w-20 rounded-md bg-gradient-to-r from-slate-150 to-slate-100" />
          </div>
        </div>

        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className="w-full max-w-[450px] animate-fade-in">

        <div className="border border-slate-100 rounded-xl shadow-sm p-4 bg-white overflow-hidden relative">
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{ animation: "shimmer 2s infinite" }}
          />

          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg w-24 h-32 flex-shrink-0" />

            {/* Text content */}
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-md w-3/4" />
              <div className="h-3 bg-gradient-to-r from-slate-150 to-slate-100 rounded-md w-1/2" />
              <div className="space-y-2 pt-2">
                <div className="h-2.5 bg-slate-100 rounded w-full" />
                <div className="h-2.5 bg-slate-100 rounded w-5/6" />
                <div className="h-2.5 bg-slate-100 rounded w-4/6" />
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (variant === "alternate") {
    return (
      <div className="w-full animate-fade-in">

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {/* Info card skeleton - black with subtle animation */}
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-5 h-48 flex items-center justify-center relative overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5" />
          </div>

          {/* Card skeletons */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border border-slate-100 rounded-xl shadow-sm p-3 bg-white overflow-hidden relative">
              <div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                style={{
                  animation: "shimmer 2s infinite",
                  animationDelay: `${i * 0.1}s`
                }}
              />
              <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg w-full aspect-[2.5/3.5]" />
              <div className="h-3 w-12 rounded-md bg-gradient-to-r from-slate-200 to-slate-100 mt-2 mx-auto" />
            </div>
          ))}
        </div>

        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // Grid variant
  return (
    <div className="w-full animate-fade-in">

      <div className="border border-slate-100 rounded-lg shadow-sm p-1 bg-white overflow-hidden relative">
        <div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
          style={{ animation: "shimmer 2s infinite" }}
        />
        <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-md w-full aspect-[2.5/3.5]" />
        <div className="h-2.5 w-12 rounded bg-gradient-to-r from-slate-200 to-slate-100 mt-1 mx-auto" />
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default SkeletonCard;