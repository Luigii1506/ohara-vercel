"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MasterSetsPriceToggle from "../MasterSetsPriceToggle";

type PriceField = "marketPrice" | "midPrice";

type Option = {
  value: string;
  label: string;
};

type Props = {
  region: string;
  relationType: string;
  priceField: PriceField;
  regionOptions: Option[];
  relationTypeOptions: Option[];
};

export default function MasterSetDetailFilters({
  region,
  relationType,
  priceField,
  regionOptions,
  relationTypeOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const replaceParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (
        !value ||
        (key === "region" && value === "US") ||
        (key === "relationType" && value === "all") ||
        (key === "priceField" && value === "marketPrice")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[220px_260px_auto] xl:items-center">
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
    </div>
  );
}
