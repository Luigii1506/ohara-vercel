"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartPulse, ExternalLink, RefreshCw } from "lucide-react";

interface RegionRow {
  region: string;
  cardCount: number;
  openGaps: number;
  hasDeclaredCountSource: boolean;
}

interface SetRow {
  setId: number;
  title: string;
  code: string | null;
  region: string;
  source: string;
  sourceUrl: string;
  declaredCount: number;
  ourCount: number;
  coverage: number | null;
  lastCheckedAt: string | null;
}

interface CatalogHealthResponse {
  regions: RegionRow[];
  sets: SetRow[];
}

const REGION_LABELS: Record<string, string> = {
  US: "Estados Unidos",
  JP: "Japón",
  FR: "Francia",
  KR: "Corea",
  CN: "China",
};

function coverageBadgeClass(coverage: number | null): string {
  if (coverage === null) return "bg-gray-100 text-gray-500";
  if (coverage >= 90) return "bg-green-100 text-green-700";
  if (coverage >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// Ninguna de estas páginas lee query params todavía (no hay pre-filtrado
// real) — el enlace solo lleva a la herramienta correcta; el admin filtra
// ahí manualmente por ahora.
function gapLinkForRegion(_region: string): string {
  return `/admin/catalog-gaps/regions`;
}

function resolveLinkForSet(row: SetRow): string {
  return row.source === "limitless" ? "/admin/limitless-sync" : "/admin/official-sync";
}

function formatDate(value: string | null): string {
  if (!value) return "nunca";
  const date = new Date(value);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CatalogHealthPage() {
  const [data, setData] = useState<CatalogHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog-health", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Error al cargar la salud del catálogo");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <HeartPulse className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Salud del catálogo
              </h1>
              <p className="text-sm text-gray-500">
                Vista de solo lectura — junta lo que ya reportan Limitless
                Sync, Official Sync y Catalog Gaps. No modifica nada; cada
                fila enlaza a la herramienta que sí puede resolverlo.
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {data?.regions.map((r) => (
            <div
              key={r.region}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {REGION_LABELS[r.region] ?? r.region}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {r.cardCount.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-gray-500">cartas en catálogo</p>
              {r.hasDeclaredCountSource ? (
                <p className="text-xs text-gray-400 mt-2">
                  cobertura por set abajo ↓
                </p>
              ) : (
                <Link
                  href={gapLinkForRegion(r.region)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                >
                  {r.openGaps} gaps abiertos <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Cobertura por set (peor primero)
            </h2>
            <p className="text-xs text-gray-500">
              Solo sets con una URL de fuente guardada (Limitless u Official
              Sync) — ligar más sets desde{" "}
              <Link href="/admin/sets" className="text-blue-600 hover:underline">
                /admin/sets
              </Link>{" "}
              aumenta lo que se ve aquí.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Set</th>
                  <th className="text-left px-4 py-2">Región</th>
                  <th className="text-left px-4 py-2">Fuente</th>
                  <th className="text-right px-4 py-2">Tuyo</th>
                  <th className="text-right px-4 py-2">Declarado</th>
                  <th className="text-right px-4 py-2">Cobertura</th>
                  <th className="text-left px-4 py-2">Verificado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && data?.sets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      Todavía no hay sets con una fuente enlazada.
                    </td>
                  </tr>
                )}
                {data?.sets.map((row) => (
                  <tr key={`${row.setId}-${row.source}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {row.title}
                      {row.code ? (
                        <span className="text-gray-400"> ({row.code})</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {REGION_LABELS[row.region] ?? row.region}
                    </td>
                    <td className="px-4 py-2 text-gray-600 capitalize">
                      {row.source}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.ourCount}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.declaredCount}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${coverageBadgeClass(
                          row.coverage
                        )}`}
                      >
                        {row.coverage === null ? "—" : `${row.coverage}%`}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {formatDate(row.lastCheckedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={resolveLinkForSet(row)}
                        className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1"
                      >
                        revisar <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
