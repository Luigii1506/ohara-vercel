"use client";

import CardEye from "@/components/Icons/CardEye";
import EyeClose from "@/components/Icons/EyeClose";

interface ViewAlternatesSwitchProps {
  viewAlternates: boolean;
  setViewAlternates: (viewAlternates: boolean) => void;
  setIsDataReady: (isDataReady: boolean) => void;
}

export default function ViewAlternatesSwitch({
  viewAlternates,
  setViewAlternates,
  setIsDataReady,
}: ViewAlternatesSwitchProps) {
  const toggleView = () => {
    setIsDataReady(false);
    setViewAlternates(!viewAlternates);
  };

  return (
    <button
      type="button"
      onClick={toggleView}
      aria-pressed={viewAlternates}
      className={`relative flex items-center justify-center w-[42px] h-[42px] rounded-lg border transition-colors duration-200 pl-[3px] ${
        viewAlternates ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      {viewAlternates ? (
        <EyeClose size="28" color={viewAlternates ? "#FFFFFF" : "#000000"} />
      ) : (
        <CardEye size="28" color={viewAlternates ? "#FFFFFF" : "#000000"} />
      )}
      <span className="sr-only">Alternar vista</span>
    </button>
  );
}
