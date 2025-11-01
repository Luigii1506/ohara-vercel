"use client";

import { useCacheAnalytics } from "@/hooks/useCacheAnalytics";

/**
 * 📈 Componente Debug para visualizar stats (dev only)
 */
export const CacheAnalyticsDebugPanel = () => {
  const {
    stats,
    getFormattedCacheSize,
    getCacheHealth,
    resetStats,
    logStats,
  } = useCacheAnalytics();

  if (process.env.NODE_ENV !== "development") return null;

  const health = getCacheHealth();
  const healthColor = {
    excellent: "text-green-600",
    good: "text-blue-600",
    fair: "text-yellow-600",
    poor: "text-red-600",
  }[health];

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 max-w-xs z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">📊 Cache Analytics</h3>
        <button
          onClick={resetStats}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Reset
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Hit Rate:</span>
          <span className={`font-semibold ${healthColor}`}>
            {stats.hitRate.toFixed(1)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Hits / Misses:</span>
          <span className="font-mono">
            {stats.hits} / {stats.misses}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Cache Size:</span>
          <span className="font-mono">{getFormattedCacheSize()}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Queries:</span>
          <span className="font-mono">{stats.queryCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Health:</span>
          <span className={`font-semibold ${healthColor} capitalize`}>
            {health}
          </span>
        </div>
      </div>

      <button
        onClick={logStats}
        className="mt-3 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 rounded"
      >
        Log to Console
      </button>
    </div>
  );
};
