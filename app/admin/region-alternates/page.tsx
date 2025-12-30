"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { REGION_OPTIONS, type RegionOption } from "@/lib/regions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw } from "lucide-react";

type CandidateCard = {
  id: number;
  code: string;
  name: string;
  src: string;
  imageKey?: string | null;
  alternateArt?: string | null;
  setCode?: string | null;
};

type RegionAlternateItem = {
  id: number;
  code: string;
  name: string;
  src: string;
  imageKey?: string | null;
  region?: string | null;
  language?: string | null;
  alternateArt?: string | null;
  setCode?: string | null;
  usCandidates: CandidateCard[];
};

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "https://images.oharatcg.com";
const FALLBACK_IMAGE = "/assets/images/backcard.webp";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

const resolveImageSrc = (card: {
  src?: string | null;
  imageKey?: string | null;
}) => {
  if (card.src) return card.src;
  if (card.imageKey) return `${WORKER_URL}/cards/${card.imageKey}.webp`;
  return FALLBACK_IMAGE;
};

export default function RegionAlternatesPage() {
  const regionOptions = useMemo<RegionOption[]>(
    () => REGION_OPTIONS.filter((option) => option.code !== "US"),
    []
  );

  const [region, setRegion] = useState(regionOptions[0]?.code ?? "JP");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<RegionAlternateItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [selectedSource, setSelectedSource] = useState<
    Record<number, number | null>
  >({});

  const fetchPage = useCallback(
    async (cursor: number | null, replace = false) => {
      const params = new URLSearchParams();
      params.set("region", region);
      params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (cursor) params.set("cursor", String(cursor));

      const response = await fetch(`/api/admin/region-alternates?${params}`);
      if (!response.ok) {
        throw new Error("Failed to load region alternates.");
      }
      const data = await response.json();
      const incoming = data.items as RegionAlternateItem[];

      setItems((prev) => {
        const next = replace ? incoming : [...prev, ...incoming];
        return next;
      });

      setNextCursor(data.nextCursor ?? null);

      setSelectedSource((prev) => {
        const updated = { ...prev };
        incoming.forEach((item) => {
          if (updated[item.id] !== undefined) return;
          updated[item.id] = item.usCandidates[0]?.id ?? null;
        });
        return updated;
      });
    },
    [region, status, search]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems([]);
    setNextCursor(null);

    const timer = setTimeout(() => {
      if (!active) return;
      fetchPage(null, true)
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await fetchPage(nextCursor, false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleApply = async (item: RegionAlternateItem) => {
    const sourceId = selectedSource[item.id];
    if (!sourceId) return;
    setSavingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await fetch(
        `/api/admin/region-alternates/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceCardId: sourceId }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update alternate art.");
      }
      const updated = await response.json();
      setItems((prev) =>
        prev.map((card) =>
          card.id === item.id
            ? { ...card, alternateArt: updated.alternateArt }
            : card
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Region Alternates
          </h1>
          <p className="text-sm text-gray-500">
            Match non-US alternates with their US counterpart to copy
            alternateArt.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-3">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {regionOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by code or name"
                className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 shadow-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fetchPage(null, true)}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Loading region alternates...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No cards found for the selected filters.
        </div>
      ) : (
        <div className="grid gap-6">
          {items.map((item) => {
            const regionalImage = resolveImageSrc(item);
            const sourceId = selectedSource[item.id] ?? null;
            const selectedCandidate = item.usCandidates.find(
              (candidate) => candidate.id === sourceId
            );

            return (
              <Card
                key={item.id}
                className="flex flex-col gap-4 border border-gray-200 bg-white p-4 shadow-sm md:flex-row"
              >
                <div className="w-full md:w-[240px]">
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-gray-100">
                    <Image
                      src={regionalImage}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <Badge variant="outline">{item.region}</Badge>
                      {item.language ? (
                        <Badge variant="outline">{item.language}</Badge>
                      ) : null}
                      {item.setCode ? (
                        <Badge variant="secondary">{item.setCode}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {item.name}
                    </p>
                    <p className="text-xs font-mono text-gray-500">
                      {item.code}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current:{" "}
                      <span className="font-medium text-gray-800">
                        {item.alternateArt || "—"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      US Candidates
                    </p>
                    {selectedCandidate?.alternateArt ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {selectedCandidate.alternateArt}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No alternateArt</Badge>
                    )}
                  </div>

                  {item.usCandidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                      No US alternates found for this code.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {item.usCandidates.map((candidate) => {
                        const candidateImage = resolveImageSrc(candidate);
                        const isSelected = candidate.id === sourceId;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() =>
                              setSelectedSource((prev) => ({
                                ...prev,
                                [item.id]: candidate.id,
                              }))
                            }
                            className={`rounded-xl border p-2 text-left transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-100">
                              <Image
                                src={candidateImage}
                                alt={candidate.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <p className="text-xs font-semibold text-gray-900 line-clamp-1">
                                {candidate.name}
                              </p>
                              <p className="text-[11px] font-mono text-gray-500">
                                {candidate.code}
                              </p>
                              {candidate.alternateArt ? (
                                <p className="text-[11px] text-gray-500">
                                  {candidate.alternateArt}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400">
                                  No alternateArt
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleApply(item)}
                      disabled={!sourceId || savingIds[item.id]}
                    >
                      {savingIds[item.id] ? "Saving..." : "Copy alternateArt"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {nextCursor && !loading ? (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
