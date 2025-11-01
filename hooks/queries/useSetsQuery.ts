import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";
import { useMemo } from "react";

interface Set {
  id: string;
  title: string;
}

/**
 * Fetch all sets from the API
 */
const fetchSets = async (): Promise<Set[]> => {
  const response = await fetch("/api/admin/sets");
  if (!response.ok) {
    throw new Error(`Failed to fetch sets: ${response.status}`);
  }
  return response.json();
};

/**
 * Hook to fetch all sets
 */
export const useSetsQuery = () => {
  return useQuery({
    queryKey: queryKeys.sets.all,
    queryFn: fetchSets,
    // Sets are very stable, fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep in cache longer than cards
    gcTime: 15 * 60 * 1000, // 15 min garbage collection time
  });
};

/**
 * Hook that returns sets in dropdown format
 * Replaces the manual transformation in edit-card
 */
export const useSetsDropdownQuery = () => {
  const { data: sets, ...rest } = useSetsQuery();

  const setsDropdown = useMemo(
    () => sets?.map((set) => ({ value: set.id, label: set.title })) || [],
    [sets]
  );

  return {
    ...rest,
    data: setsDropdown,
  };
};
