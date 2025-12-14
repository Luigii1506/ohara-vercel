"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import LazyImage from "@/components/LazyImage";

interface SnapshotInfo {
  market?: string | null;
  low?: string | null;
  high?: string | null;
  updatedAt?: string | null;
}

interface LinkedProductDetail {
  product?: {
    name?: string | null;
    url?: string | null;
  } | null;
  pricing?: {
    marketPrice?: number | null;
  } | null;
}

interface CardDetailsSectionProps {
  selectedLinkCard: any;
  snapshotInfo: SnapshotInfo | null;
  linkedProduct: LinkedProductDetail | null;
  linking: boolean;
  handleUnlinkProduct: () => void;
  formatPriceValue: (
    price?: number | string | null,
    currency?: string | null
  ) => string | null;
  onPreviewEnter?: (src?: string | null, alt?: string) => void;
  onPreviewLeave?: () => void;
}

export function CardDetailsSection({
  selectedLinkCard,
  snapshotInfo,
  linkedProduct,
  linking,
  handleUnlinkProduct,
  formatPriceValue,
  onPreviewEnter,
  onPreviewLeave,
}: CardDetailsSectionProps) {
  if (!selectedLinkCard) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="w-full max-w-[240px] mx-auto lg:mx-0 shrink-0">
        <div
          className="w-full"
          onMouseEnter={() =>
            onPreviewEnter?.(selectedLinkCard.src, selectedLinkCard.name)
          }
          onMouseLeave={onPreviewLeave}
        >
          <LazyImage
            src={selectedLinkCard.src}
            fallbackSrc="/assets/images/backcard.webp"
            alt={selectedLinkCard.name}
            size="small"
            className="w-full rounded-lg border-2 border-gray-200 shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">
              {selectedLinkCard.name}
            </h2>
            <Badge variant="outline" className="text-sm">
              {selectedLinkCard.code}
            </Badge>
            {selectedLinkCard.tcgplayerProductId && (
              <Badge className="bg-green-600 text-white hover:bg-green-700">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  Linked
                </span>
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="font-medium">Set:</span>
            <span className="text-foreground">
              {selectedLinkCard.sets?.[0]?.set?.title ??
                selectedLinkCard.setCode ??
                "Unknown"}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="font-medium">Rarity:</span>{" "}
            {selectedLinkCard.rarity ?? "—"}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Price Information
          </h3>
          {snapshotInfo ? (
            <div className="rounded-lg border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 flex flex-col">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Market Price
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {snapshotInfo.market}
                  </p>
                </div>
                {snapshotInfo.low && (
                  <div className="space-y-1 flex flex-col">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Low
                    </p>
                    <p className="text-lg font-semibold text-blue-600">
                      {snapshotInfo.low}
                    </p>
                  </div>
                )}
                {snapshotInfo.high && (
                  <div className="space-y-1 flex flex-col">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      High
                    </p>
                    <p className="text-lg font-semibold text-orange-600">
                      {snapshotInfo.high}
                    </p>
                  </div>
                )}
              </div>
              {snapshotInfo.updatedAt && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  Last updated: {snapshotInfo.updatedAt}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-sm text-muted-foreground italic text-center">
                No price snapshot available yet
              </p>
            </div>
          )}
        </div>

        {selectedLinkCard?.tcgplayerProductId && linkedProduct && (
          <div className="space-y-2 flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">
              TCGplayer Product
            </h3>
            <div className="rounded-lg border bg-white p-4 space-y-3 flex flex-col">
              <p className="font-semibold text-base">
                {linkedProduct.product?.name ?? "Unknown product"}
              </p>
              {linkedProduct.pricing?.marketPrice && (
                <p className="text-sm text-muted-foreground mt-1">
                  Market Price:{" "}
                  <span className="font-semibold text-foreground">
                    {formatPriceValue(
                      linkedProduct.pricing.marketPrice,
                      selectedLinkCard?.priceCurrency
                    )}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {selectedLinkCard.tcgUrl && (
            <Button variant="default" asChild className="gap-2">
              <Link href={selectedLinkCard.tcgUrl} target="_blank">
                View on TCGplayer
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}

          {linkedProduct?.product?.url && (
            <Button variant="outline" asChild className="gap-2 bg-transparent">
              <Link href={linkedProduct.product.url} target="_blank">
                View Linked Product
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}

          {selectedLinkCard.tcgplayerProductId && (
            <Button
              variant="destructive"
              onClick={handleUnlinkProduct}
              disabled={linking}
              className="sm:ml-auto"
            >
              {linking ? "Unlinking..." : "Unlink Product"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
