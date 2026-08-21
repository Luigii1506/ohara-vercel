"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PriceFieldToggle, {
  type PriceField,
} from "@/components/PriceFieldToggle";

type Props = {
  value: PriceField;
};

export default function MasterSetsPriceToggle({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (nextValue: PriceField) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue === "marketPrice") {
      params.delete("priceField");
    } else {
      params.set("priceField", nextValue);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <PriceFieldToggle value={value} onChange={handleChange} />;
}
