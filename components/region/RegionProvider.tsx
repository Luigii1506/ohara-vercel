"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_REGION, REGION_OPTIONS, type RegionOption } from "@/lib/regions";

type RegionContextValue = {
  region: string;
  setRegion: (region: string) => void;
  regions: RegionOption[];
};

const RegionContext = createContext<RegionContextValue | null>(null);

const STORAGE_KEY = "ohara-region";

export const RegionProvider = ({ children }: { children: React.ReactNode }) => {
  const [region, setRegionState] = useState<string>(DEFAULT_REGION);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) {
      setRegionState(stored.trim());
      return;
    }
    setRegionState(DEFAULT_REGION);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, region);
  }, [region]);

  const setRegion = useCallback((nextRegion: string) => {
    setRegionState(nextRegion?.trim() ? nextRegion.trim() : DEFAULT_REGION);
  }, []);

  const value = useMemo(
    () => ({
      region,
      setRegion,
      regions: REGION_OPTIONS,
    }),
    [region, setRegion]
  );

  return (
    <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
  );
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error("useRegion must be used within RegionProvider");
  }
  return context;
};
