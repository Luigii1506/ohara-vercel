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
      <div className="relative overflow-hidden rounded-lg w-full h-full bg-[#11180f]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#11180f] via-[#1f2b1a] to-[#0f1510] opacity-95" />
        <div className="relative flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="mb-4 sm:mb-6">
            <img
              src="/assets/images/LOGO_OHARA.svg"
              alt="Ohara"
              className="mx-auto h-auto w-44 sm:w-60 drop-shadow-[0_8px_20px_rgba(0,0,0,0.65)] brightness-125 contrast-110"
            />
          </div>
          <div className="text-2xl sm:text-3xl font-bold uppercase tracking-[0.18em] text-white">
            {name}
          </div>
          <div className="mt-3 text-sm sm:text-base text-slate-200">
            {cardCount} cartas
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">
            Carpeta Oficial
          </div>
        </div>
      </div>
    </div>
  );
};
