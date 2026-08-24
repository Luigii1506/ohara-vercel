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
  /** Códigos actualmente seleccionados (uno o más), ej. ["US"] o ["US", "JP"]. */
  selectedRegions: string[];
  /** selectedRegions.join(",") — para código que ya pasa `region` directo a
   * la API como query param; lib/cards/query.ts sabe separar por coma. */
  region: string;
  /** Prende/apaga un código de la selección. Nunca deja la lista vacía —
   * si se apaga el último, no hace nada (siempre debe quedar al menos uno). */
  toggleRegion: (code: string) => void;
  /** Reemplaza la selección completa. */
  setRegions: (codes: string[]) => void;
  /** Compatibilidad con el código existente que solo maneja una región:
   * selecciona ÚNICAMENTE ese código (reemplaza la lista entera). */
  setRegion: (code: string) => void;
  /** Todas las regiones disponibles para mostrar en el selector. */
  regionOptions: RegionOption[];
};

const RegionContext = createContext<RegionContextValue | null>(null);

const STORAGE_KEY = "ohara-region";
const VALID_CODES = new Set(REGION_OPTIONS.map((option) => option.code));

const sanitizeRegions = (codes: string[]): string[] => {
  const cleaned = Array.from(
    new Set(codes.map((code) => code?.trim()).filter((code) => code && VALID_CODES.has(code)))
  ) as string[];
  return cleaned.length ? cleaned : [DEFAULT_REGION];
};

const parseStored = (raw: string | null): string[] | null => {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sanitizeRegions(parsed);
  } catch {
    // Formato viejo: un solo string plano (ej. "US"), no JSON.
  }
  return sanitizeRegions([raw]);
};

export const RegionProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedRegions, setSelectedRegions] = useState<string[]>([DEFAULT_REGION]);

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    setSelectedRegions(stored ?? [DEFAULT_REGION]);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedRegions));
  }, [selectedRegions]);

  const setRegions = useCallback((codes: string[]) => {
    setSelectedRegions(sanitizeRegions(codes));
  }, []);

  const setRegion = useCallback((code: string) => {
    setSelectedRegions(sanitizeRegions([code]));
  }, []);

  const toggleRegion = useCallback((code: string) => {
    setSelectedRegions((current) => {
      if (current.includes(code)) {
        const next = current.filter((c) => c !== code);
        return next.length ? next : current; // no dejar la selección vacía
      }
      return sanitizeRegions([...current, code]);
    });
  }, []);

  const value = useMemo<RegionContextValue>(
    () => ({
      selectedRegions,
      region: selectedRegions.join(","),
      toggleRegion,
      setRegions,
      setRegion,
      regionOptions: REGION_OPTIONS,
    }),
    [selectedRegions, toggleRegion, setRegions, setRegion]
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
