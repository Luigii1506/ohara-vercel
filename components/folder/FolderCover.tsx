import React from "react";

interface FolderCoverProps {
  name: string;
  color: string;
  cardCount: number;
  width: number;
  height: number;
}

export const FolderCover: React.FC<FolderCoverProps> = ({
  name,
  color,
  cardCount,
  width,
  height,
}) => {
  return (
    <div
      className="relative single-page-container flex items-center justify-center"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    >
      <div
        className="relative overflow-hidden transition-colors duration-300 rounded-lg w-full h-full"
        style={{
          backgroundColor: color || "rgb(30, 41, 59)",
        }}
      >
        {/* External folder cover design (front of folder) */}
        <div className="flex items-center justify-center h-full p-4 sm:p-8">
          <div className="text-center">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">📂</div>
            <div className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
              {name}
            </div>
            <div className="text-base sm:text-lg text-gray-200 mb-1 sm:mb-2">
              {cardCount} cartas
            </div>
            <div className="text-sm text-gray-300">Carpeta de colección</div>
          </div>
        </div>
      </div>
    </div>
  );
};
