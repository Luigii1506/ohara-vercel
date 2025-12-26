"use client";

import React, { useMemo } from "react";
import { DeckCard } from "@/types";

interface MobileDeckStatsProps {
  deck: DeckCard[];
}

function parseNumberFromString(str: string | null): number {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

interface BarData {
  label: string;
  value: number;
  percentage: number;
}

const StatBar = ({
  label,
  value,
  color,
  maxValue,
}: {
  label: string;
  value: number;
  color: string;
  maxValue: number;
}) => {
  const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-h-[28px]">
      <div className="w-10 shrink-0 text-right text-[11px] font-semibold text-slate-600 tabular-nums">
        {label}
      </div>
      <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative min-w-0">
        <div
          className="h-full rounded-md"
          style={{
            width: `${Math.max(widthPercent, value > 0 ? 8 : 0)}%`,
            backgroundColor: color,
          }}
        />
        {value > 0 && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-700"
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
};

const StatSection = ({
  title,
  data,
  color,
}: {
  title: string;
  data: BarData[];
  color: string;
}) => {
  const maxValue = Math.max(...data.map((d) => d.value), 0);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-3 border border-slate-200">
      <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {title}
      </h3>
      <div className="space-y-1">
        {data.map((item) => (
          <StatBar
            key={item.label}
            label={item.label}
            value={item.value}
            color={color}
            maxValue={maxValue}
          />
        ))}
      </div>
    </div>
  );
};

const MobileDeckStats: React.FC<MobileDeckStatsProps> = ({ deck }) => {
  const stats = useMemo(() => {
    const costCurve: Record<number, number> = {};
    const powerCurve: Record<number, number> = {};
    const counterCurve: Record<number, number> = {};
    const categoryCurve: Record<string, number> = {};

    deck?.forEach((card) => {
      const qty = card.quantity;

      // Cost
      const costVal = parseNumberFromString(card.cost);
      costCurve[costVal] = (costCurve[costVal] || 0) + qty;

      // Power (group by thousands)
      const powerVal = parseNumberFromString(card.power);
      if (powerVal > 0) {
        const powerKey = Math.floor(powerVal / 1000);
        powerCurve[powerKey] = (powerCurve[powerKey] || 0) + qty;
      }

      // Counter
      const counterVal = parseNumberFromString(card.counter);
      if (counterVal > 0) {
        counterCurve[counterVal] = (counterCurve[counterVal] || 0) + qty;
      }

      // Category
      const category = card.category || "Other";
      categoryCurve[category] = (categoryCurve[category] || 0) + qty;
    });

    const toBarData = (
      curve: Record<number | string, number>,
      formatLabel?: (key: string) => string
    ): BarData[] => {
      const entries = Object.entries(curve);
      const total = entries.reduce((sum, [, val]) => sum + val, 0);
      return entries
        .sort((a, b) => {
          const numA = Number(a[0]);
          const numB = Number(b[0]);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a[0].localeCompare(b[0]);
        })
        .map(([label, value]) => ({
          label: formatLabel ? formatLabel(label) : label,
          value,
          percentage: total > 0 ? (value / total) * 100 : 0,
        }));
    };

    return {
      cost: toBarData(costCurve),
      power: toBarData(powerCurve, (k) => `${k}k`),
      counter: toBarData(counterCurve, (k) => `+${Number(k) / 1000}k`),
      category: toBarData(categoryCurve),
    };
  }, [deck]);

  const totalCards = deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;

  if (totalCards === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400 text-sm">Add cards to see stats</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Single-column layout for clearer charts */}
      <div className="grid grid-cols-1 gap-2">
        {/* Cost Curve */}
        <StatSection title="Cost" data={stats.cost} color="#ef4444" />

        {/* Power Curve */}
        <StatSection title="Power" data={stats.power} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* Counter Curve */}
        <StatSection title="Counter" data={stats.counter} color="#0ea5e9" />

        {/* Category */}
        <StatSection title="Type" data={stats.category} color="#f59e0b" />
      </div>
    </div>
  );
};

export default MobileDeckStats;
