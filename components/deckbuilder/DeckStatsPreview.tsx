// components/DeckStats.tsx
import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { DeckCard } from "@/types";
import { useI18n } from "@/components/i18n/I18nProvider";

// Registro de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DeckStatsProps {
  deck: DeckCard[];
}

// Función auxiliar para extraer el número de un string (por ejemplo, "3000 Power", "2 Cost" o "+2000 Counter")
function parseNumberFromString(str: string | null): number {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const DeckStats: React.FC<DeckStatsProps> = ({ deck }) => {
  const { t } = useI18n();
  // Acumuladores para cada curva
  const powerCurve: Record<number, number> = {};
  const costCurve: Record<number, number> = {};
  const attributeCurve: Record<string, number> = {};
  const counterCurve: Record<number, number> = {};
  let totalCards = 0;

  // Recorremos cada carta del deck
  deck?.forEach((card) => {
    const qty = card.quantity;
    totalCards += qty;

    // Power Curve: extraemos el valor numérico de "power"
    const powerVal = parseNumberFromString(card.power);
    powerCurve[powerVal] = (powerCurve[powerVal] || 0) + qty;

    // Cost Curve: extraemos el valor numérico de "cost"
    const costVal = parseNumberFromString(card.cost);
    costCurve[costVal] = (costCurve[costVal] || 0) + qty;

    // Attribute Curve: se usa el valor de "attribute"
    const attributeVal = card.attribute || "N/A";
    attributeCurve[attributeVal] = (attributeCurve[attributeVal] || 0) + qty;

    // Counter Curve: extraemos el valor numérico de "counter"
    const counterVal = parseNumberFromString(card.counter);
    counterCurve[counterVal] = (counterCurve[counterVal] || 0) + qty;
  });

  // Convertimos los objetos acumulados a arrays para los gráficos
  const powerLabels = Object.keys(powerCurve).sort(
    (a, b) => Number(a) - Number(b)
  );
  const powerData = powerLabels.map((label) => powerCurve[Number(label)]);

  const costLabels = Object.keys(costCurve).sort(
    (a, b) => Number(a) - Number(b)
  );
  const costData = costLabels.map((label) => costCurve[Number(label)]);

  const attributeLabels = Object.keys(attributeCurve);
  const attributeData = attributeLabels.map((label) => attributeCurve[label]);

  const counterLabels = Object.keys(counterCurve).sort(
    (a, b) => Number(a) - Number(b)
  );
  const counterData = counterLabels.map((label) => counterCurve[Number(label)]);

  // Opciones comunes para las gráficas de barras
  const commonOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Power Curve */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">
            {t("deckStats.powerCurve")}
          </h2>
          <Bar
            data={{
              labels: powerLabels,
              datasets: [
                {
                  data: powerData,
                  backgroundColor: "#953a8b", // Indigo-500
                },
              ],
            }}
            options={commonOptions}
          />
        </div>

        {/* Cost Curve */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">
            {t("deckStats.costCurve")}
          </h2>
          <Bar
            data={{
              labels: costLabels,
              datasets: [
                {
                  data: costData,
                  backgroundColor: "#dd242e", // Emerald-500
                },
              ],
            }}
            options={commonOptions}
          />
        </div>

        {/* Attribute Curve */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">
            {t("deckStats.attributeCurve")}
          </h2>
          <Bar
            data={{
              labels: attributeLabels,
              datasets: [
                {
                  data: attributeData,
                  backgroundColor: "#218f68", // Blue-500
                },
              ],
            }}
            options={commonOptions}
          />
        </div>

        {/* Counter Curve */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">
            {t("deckStats.counterCurve")}
          </h2>
          <Bar
            data={{
              labels: counterLabels,
              datasets: [
                {
                  data: counterData,
                  backgroundColor: "#007ab1", // Yellow-400
                },
              ],
            }}
            options={commonOptions}
          />
        </div>
      </div>

      {/* Total Cards */}
      {/* <div className="mt-4 bg-white shadow rounded p-4 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-2">Total Cards</h2>
        <p className="text-2xl font-bold">{totalCards}</p>
      </div> */}
    </div>
  );
};

export default DeckStats;
