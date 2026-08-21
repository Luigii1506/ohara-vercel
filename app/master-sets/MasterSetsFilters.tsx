"use client";

import { FormEvent, useState } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MasterSetsPriceToggle from "./MasterSetsPriceToggle";

type PriceField = "marketPrice" | "midPrice";

type Option = {
  value: string;
  label: string;
};

type Props = {
  search: string;
  region: string;
  relationType: string;
  priceField: PriceField;
  regionOptions: Option[];
  relationTypeOptions: Option[];
};

export default function MasterSetsFilters({
  search,
  region,
  relationType,
  priceField,
  regionOptions,
  relationTypeOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  const replaceParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value || (key === "region" && value === "US") || (key === "relationType" && value === "all") || (key === "priceField" && value === "marketPrice")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceParams({ search: searchValue.trim() });
  };

  const handleClearSearch = () => {
    setSearchValue("");
    replaceParams({ search: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-2 lg:grid-cols-[minmax(0,1.3fr)_220px_260px_auto]">
      <div className="relative">
        <button
          type="submit"
          aria-label="Buscar personaje"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
        >
          <Search className="h-4 w-4" />
        </button>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Buscar personaje"
          className="h-[42px] w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none transition focus:border-slate-400"
        />
        {searchValue ? (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Limpiar busqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Select value={region} onValueChange={(value) => replaceParams({ region: value })}>
        <SelectTrigger className="h-[42px] rounded-lg border-slate-200 bg-white px-4 text-sm">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          {regionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={relationType}
        onValueChange={(value) => replaceParams({ relationType: value })}
      >
        <SelectTrigger className="h-[42px] rounded-lg border-slate-200 bg-white px-4 text-sm">
          <SelectValue placeholder="Tipo de relacion" />
        </SelectTrigger>
        <SelectContent>
          {relationTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <MasterSetsPriceToggle value={priceField} />
    </form>
  );
}
